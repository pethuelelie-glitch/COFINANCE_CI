# Module 01 — Accounts : Views


from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken
from drf_spectacular.utils import extend_schema, OpenApiResponse, OpenApiExample

from account.models import CustomUser
from account.serializers import (
    RegisterSerializer,
    LoginSerializer,
    ProfileSerializer,
    CustomTokenObtainPairSerializer,
)


@extend_schema(
    tags=['Auth'],
    summary="Inscription d'un nouveau client",
    description=(
        "Permet à un nouveau client de s'inscrire. "
        "Le rôle CLIENT est attribué automatiquement. "
        "Les agents et admins sont créés par l'administration."
    ),
    request=RegisterSerializer,
    responses={
        201: OpenApiResponse(description="Inscription réussie, tokens JWT retournés"),
        400: OpenApiResponse(description="Données invalides"),
    },
    examples=[
        OpenApiExample(
            "Exemple d'inscription",
            value={
                "email": "client1@cofci.ci",
                "first_name": "Ama",
                "last_name": "Kouassi",
                "phone": "+2250700000001",
                "password": "Client1234!",
                "password_confirm": "Client1234!",
            },
            request_only=True,
        )
    ]
)
class RegisterView(APIView):
    """Inscription d'un nouveau client."""

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        # Générer les tokens JWT
        refresh = RefreshToken.for_user(user)
        refresh['role'] = user.role
        refresh['email'] = user.email
        refresh['full_name'] = user.get_full_name()

        return Response(
            {
                'success': True,
                'message': 'Inscription réussie.',
                'user': ProfileSerializer(user).data,
                'tokens': {
                    'access': str(refresh.access_token),
                    'refresh': str(refresh),
                }
            },
            status=status.HTTP_201_CREATED
        )


@extend_schema(
    tags=['Auth'],
    summary="Connexion et obtention des tokens JWT",
    description="Authentification par email + mot de passe. Retourne access et refresh token.",
    request=LoginSerializer,
    responses={
        200: OpenApiResponse(description="Connexion réussie, tokens JWT retournés"),
        400: OpenApiResponse(description="Identifiants invalides"),
    },
)
class LoginView(APIView):
    """Connexion utilisateur."""

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']

        refresh = RefreshToken.for_user(user)
        refresh['role'] = user.role
        refresh['email'] = user.email
        refresh['full_name'] = user.get_full_name()

        return Response(
            {
                'success': True,
                'message': 'Connexion réussie.',
                'user': ProfileSerializer(user).data,
                'tokens': {
                    'access': str(refresh.access_token),
                    'refresh': str(refresh),
                }
            },
            status=status.HTTP_200_OK
        )


@extend_schema(
    tags=['Auth'],
    summary="Profil utilisateur",
    description="GET : Consultation du profil. PUT/PATCH : Mise à jour des informations personnelles.",
    responses={200: ProfileSerializer},
)
class ProfileView(APIView):
    """Consultation et mise à jour du profil utilisateur."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = ProfileSerializer(request.user)
        return Response({'success': True, 'data': serializer.data})

    def put(self, request):
        return self._update(request, partial=False)

    def patch(self, request):
        return self._update(request, partial=True)

    def _update(self, request, partial=False):
        serializer = ProfileSerializer(
            request.user,
            data=request.data,
            partial=partial,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            {'success': True, 'message': 'Profil mis à jour.', 'data': serializer.data}
        )


from account.permission import IsAgentOrAdmin, IsAdmin


@extend_schema(
    tags=['Auth'],
    summary="Liste des agents",
    description="Retourne la liste des utilisateurs avec le rôle AGENT. Réservé aux agents et admins.",
    responses={200: ProfileSerializer(many=True)},
)
class AgentsListView(APIView):
    """Liste des agents disponibles (pour l'assignation des conversations)."""

    permission_classes = [IsAuthenticated, IsAgentOrAdmin]

    def get(self, request):
        agents = CustomUser.objects.filter(role='AGENT').order_by('first_name', 'last_name')
        return Response(ProfileSerializer(agents, many=True).data)


@extend_schema(
    tags=['Auth'],
    summary="Liste des clients",
    description="Retourne la liste de tous les clients. Réservé aux agents et admins.",
    responses={200: ProfileSerializer(many=True)},
)
class ClientsListView(APIView):
    """Liste des clients (pour la page admin-clients)."""

    permission_classes = [IsAuthenticated, IsAgentOrAdmin]

    def get(self, request):
        clients = CustomUser.objects.filter(role='CLIENT').order_by('last_name', 'first_name')
        return Response(ProfileSerializer(clients, many=True).data)


@extend_schema(
    tags=['Auth'],
    summary="Gestion des agents (admin)",
    description="Lister et créer des agents. Réservé aux administrateurs.",
)
class AdminAgentManageView(APIView):
    """Lister et créer des agents — réservé aux ADMIN."""

    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        agents = CustomUser.objects.filter(role='AGENT').order_by('first_name', 'last_name')
        result = []
        for a in agents:
            d = ProfileSerializer(a).data
            d['is_active'] = a.is_active
            result.append(d)
        return Response(result)

    def post(self, request):
        email      = request.data.get('email', '').strip()
        first_name = request.data.get('first_name', '').strip()
        last_name  = request.data.get('last_name', '').strip()
        password   = request.data.get('password', '')
        phone      = request.data.get('phone', '').strip()

        if not all([email, first_name, last_name, password]):
            return Response(
                {'error': 'email, first_name, last_name et password sont requis.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if CustomUser.objects.filter(email=email).exists():
            return Response(
                {'error': 'Cet email est déjà utilisé.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        agent = CustomUser(
            email=email, username=email,
            first_name=first_name, last_name=last_name,
            phone=phone, role='AGENT', is_active=True,
        )
        agent.set_password(password)
        agent.save()

        d = ProfileSerializer(agent).data
        d['is_active'] = True
        return Response(d, status=status.HTTP_201_CREATED)


@extend_schema(
    tags=['Auth'],
    summary="Détail client (admin)",
    description="Activer ou suspendre un client. Réservé aux administrateurs.",
)
class AdminClientDetailView(APIView):
    """Toggle actif/inactif d'un client — réservé aux ADMIN."""

    permission_classes = [IsAuthenticated, IsAdmin]

    def patch(self, request, pk):
        try:
            client = CustomUser.objects.get(pk=pk, role='CLIENT')
        except CustomUser.DoesNotExist:
            return Response({'error': 'Client non trouvé.'}, status=status.HTTP_404_NOT_FOUND)

        if 'is_active' in request.data:
            client.is_active = bool(request.data['is_active'])
            client.save(update_fields=['is_active'])

        d = ProfileSerializer(client).data
        d['is_active'] = client.is_active
        return Response(d)


@extend_schema(
    tags=['Auth'],
    summary="Détail agent (admin)",
    description="Modifier le statut d'un agent. Réservé aux administrateurs.",
)
class AdminAgentDetailView(APIView):
    """Toggle actif/inactif d'un agent — réservé aux ADMIN."""

    permission_classes = [IsAuthenticated, IsAdmin]

    def patch(self, request, pk):
        try:
            agent = CustomUser.objects.get(pk=pk, role='AGENT')
        except CustomUser.DoesNotExist:
            return Response({'error': 'Agent non trouvé.'}, status=status.HTTP_404_NOT_FOUND)

        if 'is_active' in request.data:
            agent.is_active = bool(request.data['is_active'])
            agent.save(update_fields=['is_active'])

        d = ProfileSerializer(agent).data
        d['is_active'] = agent.is_active
        return Response(d)
