# Module 01 — Accounts : URLs

from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from drf_spectacular.utils import extend_schema

from .views import (
    RegisterView, LoginView, ProfileView,
    AgentsListView, ClientsListView,
    AdminAgentManageView, AdminAgentDetailView,
    AdminClientDetailView,
)

# Surcharger le schema pour TokenRefreshView
TokenRefreshView = extend_schema(
    tags=['Auth'],
    summary="Rafraîchissement du token d'accès",
    description="Utilise le refresh token pour obtenir un nouveau access token.",
)(TokenRefreshView)

urlpatterns = [
    path('register/', RegisterView.as_view(), name='auth-register'),
    path('login/', LoginView.as_view(), name='auth-login'),
    path('token/refresh/', TokenRefreshView.as_view(), name='auth-token-refresh'),
    path('profile/', ProfileView.as_view(), name='auth-profile'),
    path('agents/', AgentsListView.as_view(), name='auth-agents'),
    path('clients/', ClientsListView.as_view(), name='auth-clients'),
    path('admin/agents/', AdminAgentManageView.as_view(), name='admin-agent-manage'),
    path('admin/agents/<int:pk>/', AdminAgentDetailView.as_view(), name='admin-agent-detail'),
    path('admin/clients/<int:pk>/', AdminClientDetailView.as_view(), name='admin-client-detail'),
]
