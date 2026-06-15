# Module 01 — Accounts : Permissions personnalisées par rôle


from rest_framework.permissions import BasePermission


class IsClient(BasePermission):
    """Autorise uniquement les utilisateurs avec le rôle CLIENT."""

    message = "Accès réservé aux clients."

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role == 'CLIENT'
        )


class IsAgent(BasePermission):
    """Autorise uniquement les utilisateurs avec le rôle AGENT."""

    message = "Accès réservé aux agents."

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role == 'AGENT'
        )


class IsAdmin(BasePermission):
    """Autorise uniquement les utilisateurs avec le rôle ADMIN."""

    message = "Accès réservé aux administrateurs."

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role == 'ADMIN'
        )


class IsAgentOrAdmin(BasePermission):
    """Autorise les AGENT et les ADMIN."""

    message = "Accès réservé aux agents et administrateurs."

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role in ('AGENT', 'ADMIN')
        )


class IsClientOrAgentOrAdmin(BasePermission):
    """Autorise tous les utilisateurs authentifiés."""

    message = "Vous devez être authentifié."

    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated


class IsOwnerOrAgentOrAdmin(BasePermission):
    """
    Pour les objets : le client propriétaire peut accéder,
    les agents et admins aussi.
    """

    message = "Accès non autorisé à cette ressource."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.role in ('AGENT', 'ADMIN'):
            return True
        # Vérifier si l'objet appartient au client connecté
        owner = getattr(obj, 'client', None) or getattr(obj, 'destinataire', None)
        return owner == request.user
