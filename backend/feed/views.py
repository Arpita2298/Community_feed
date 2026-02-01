from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.db.models import Count, Exists, OuterRef, Sum
from django.db.models.functions import Coalesce
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import Comment, CommentLike, KarmaEvent, Post, PostLike
from .serializers import (
    CommentCreateSerializer,
    PostCreateSerializer,
    PostDetailSerializer,
    PostListSerializer,
)


@api_view(['GET'])
@permission_classes([AllowAny])
def api_root(request):
    return Response(
        {
            'posts': request.build_absolute_uri('posts/'),
            'leaderboard': request.build_absolute_uri('leaderboard/'),
        }
    )


def _comment_to_dict(c, by_parent):
    return {
        'id': c.id,
        'body': c.body,
        'author': {
            'id': c.author_id,
            'username': c.author.username,
        },
        'created_at': c.created_at,
        'like_count': getattr(c, 'like_count', 0),
        'liked_by_me': getattr(c, 'liked_by_me', False),
        'children': [
            _comment_to_dict(child, by_parent)
            for child in by_parent.get(c.id, [])
        ],
    }


def build_comment_tree(post, user):
    liked_by_me_sq = CommentLike.objects.filter(comment=OuterRef('pk'), user=user)
    comments = (
        Comment.objects.filter(post=post)
        .select_related('author')
        .annotate(like_count=Count('likes', distinct=True))
        .annotate(liked_by_me=Exists(liked_by_me_sq))
        .order_by('created_at')
    )

    by_parent = {}
    roots = []

    for c in comments:
        if c.parent_id is None:
            roots.append(c)
        else:
            by_parent.setdefault(c.parent_id, []).append(c)

    return [_comment_to_dict(c, by_parent) for c in roots]


class PostListCreateView(generics.ListCreateAPIView):
    def get_queryset(self):
        liked_by_me_sq = PostLike.objects.filter(post=OuterRef('pk'), user=self.request.user)
        return (
            Post.objects.all()
            .select_related('author')
            .annotate(
                like_count=Count('likes', distinct=True),
                comment_count=Count('comments', distinct=True),
            )
            .annotate(liked_by_me=Exists(liked_by_me_sq))
        )

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return PostCreateSerializer
        return PostListSerializer

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)


class PostDetailView(generics.RetrieveAPIView):
    serializer_class = PostDetailSerializer

    def get_queryset(self):
        liked_by_me_sq = PostLike.objects.filter(post=OuterRef('pk'), user=self.request.user)
        return (
            Post.objects.all()
            .select_related('author')
            .annotate(like_count=Count('likes', distinct=True))
            .annotate(liked_by_me=Exists(liked_by_me_sq))
        )

    def retrieve(self, request, *args, **kwargs):
        post = self.get_object()
        serializer = self.get_serializer(
            post,
            context={
                **self.get_serializer_context(),
                'comments': build_comment_tree(post, request.user),
            },
        )
        return Response(serializer.data)


@api_view(['POST'])
def create_comment(request, post_id):
    post = get_object_or_404(Post, id=post_id)
    serializer = CommentCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    parent_id = serializer.validated_data.get('parent_id')
    parent = None
    if parent_id is not None:
        parent = get_object_or_404(Comment, id=parent_id, post=post)

    comment = Comment.objects.create(
        post=post,
        author=request.user,
        parent=parent,
        body=serializer.validated_data['body'],
    )

    return Response(
        {
            'id': comment.id,
            'body': comment.body,
            'author': {'id': comment.author_id, 'username': comment.author.username},
            'created_at': comment.created_at,
            'like_count': 0,
            'liked_by_me': False,
            'children': [],
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(['POST', 'DELETE'])
def post_like(request, post_id):
    post = get_object_or_404(Post, id=post_id)

    with transaction.atomic():
        if request.method == 'POST':
            try:
                PostLike.objects.create(post=post, user=request.user)
                KarmaEvent.objects.create(
                    user=post.author,
                    actor=request.user,
                    event_type='post_like',
                    delta=5,
                    post=post,
                )
                liked = True
            except IntegrityError:
                liked = True
        else:
            deleted, _ = PostLike.objects.filter(post=post, user=request.user).delete()
            if deleted:
                KarmaEvent.objects.create(
                    user=post.author,
                    actor=request.user,
                    event_type='post_unlike',
                    delta=-5,
                    post=post,
                )
            liked = False

    like_count = PostLike.objects.filter(post=post).count()
    return Response({'liked': liked, 'like_count': like_count})


@api_view(['POST', 'DELETE'])
def comment_like(request, comment_id):
    comment = get_object_or_404(Comment.objects.select_related('author'), id=comment_id)

    with transaction.atomic():
        if request.method == 'POST':
            try:
                CommentLike.objects.create(comment=comment, user=request.user)
                KarmaEvent.objects.create(
                    user=comment.author,
                    actor=request.user,
                    event_type='comment_like',
                    delta=1,
                    comment=comment,
                )
                liked = True
            except IntegrityError:
                liked = True
        else:
            deleted, _ = CommentLike.objects.filter(comment=comment, user=request.user).delete()
            if deleted:
                KarmaEvent.objects.create(
                    user=comment.author,
                    actor=request.user,
                    event_type='comment_unlike',
                    delta=-1,
                    comment=comment,
                )
            liked = False

    like_count = CommentLike.objects.filter(comment=comment).count()
    return Response({'liked': liked, 'like_count': like_count})


@api_view(['GET'])
def leaderboard(request):
    since = timezone.now() - timedelta(hours=24)
    User = get_user_model()

    rows = (
        KarmaEvent.objects.filter(created_at__gte=since)
        .values('user')
        .annotate(karma=Coalesce(Sum('delta'), 0))
        .order_by('-karma')[:5]
    )

    users = User.objects.in_bulk([r['user'] for r in rows])

    payload = []
    for r in rows:
        u = users.get(r['user'])
        if not u:
            continue
        payload.append(
            {
                'user': {'id': u.id, 'username': u.username},
                'karma': r['karma'],
            }
        )

    return Response(payload)
