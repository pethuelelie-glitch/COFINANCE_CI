from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views.credit_views import CreditRequestViewSet

router = DefaultRouter()
router.register(r'', CreditRequestViewSet, basename='credits')

urlpatterns = [
    path('', include(router.urls)),
]
