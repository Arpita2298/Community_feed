from django.contrib.auth import get_user_model
from rest_framework.authentication import BaseAuthentication


class HeaderUserAuthentication(BaseAuthentication):
    def authenticate(self, request):
        username = request.headers.get('X-User')
        if not username:
            return None

        User = get_user_model()
        user, _ = User.objects.get_or_create(username=username)
        return (user, None)
