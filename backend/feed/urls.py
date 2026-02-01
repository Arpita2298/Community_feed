from django.urls import path

from . import views


urlpatterns = [
    path('', views.api_root, name='api-root'),
    path('posts/', views.PostListCreateView.as_view(), name='post-list'),
    path('posts/<int:pk>/', views.PostDetailView.as_view(), name='post-detail'),
    path('posts/<int:post_id>/comments/', views.create_comment, name='comment-create'),
    path('posts/<int:post_id>/like/', views.post_like, name='post-like'),
    path('comments/<int:comment_id>/like/', views.comment_like, name='comment-like'),
    path('leaderboard/', views.leaderboard, name='leaderboard'),
]
