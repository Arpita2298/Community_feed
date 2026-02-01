from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import Comment, Post


User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username']


class PostListSerializer(serializers.ModelSerializer):
    author = UserSerializer(read_only=True)
    like_count = serializers.IntegerField(read_only=True)
    comment_count = serializers.IntegerField(read_only=True)
    liked_by_me = serializers.BooleanField(read_only=True)

    class Meta:
        model = Post
        fields = ['id', 'body', 'author', 'created_at', 'like_count', 'comment_count', 'liked_by_me']


class PostCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Post
        fields = ['id', 'body', 'created_at']
        read_only_fields = ['id', 'created_at']


class CommentCreateSerializer(serializers.ModelSerializer):
    parent_id = serializers.IntegerField(required=False, allow_null=True)

    class Meta:
        model = Comment
        fields = ['id', 'body', 'parent_id', 'created_at']
        read_only_fields = ['id', 'created_at']


class PostDetailSerializer(serializers.ModelSerializer):
    author = UserSerializer(read_only=True)
    like_count = serializers.IntegerField(read_only=True)
    liked_by_me = serializers.BooleanField(read_only=True)
    comments = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = ['id', 'body', 'author', 'created_at', 'like_count', 'liked_by_me', 'comments']

    def get_comments(self, obj):
        return self.context.get('comments', [])
