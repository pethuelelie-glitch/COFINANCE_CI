from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from drf_spectacular.utils import extend_schema

from account.permission import IsClient, IsAdmin, IsAgentOrAdmin
from insurance.models import InsuranceProduct, InsurancePolicy, PolicyStatus
from insurance.serializers import InsuranceProductSerializer, InsurancePolicySerializer

class ProductListView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(
        tags=['Assurance'],
        summary="Catalogue des formules",
        responses={200: InsuranceProductSerializer(many=True)}
    )
    def get(self, request):
        products = InsuranceProduct.objects.all()
        return Response(InsuranceProductSerializer(products, many=True).data)

class SubscribeView(APIView):
    permission_classes = [IsAuthenticated, IsClient]

    @extend_schema(
        tags=['Assurance'],
        summary="Souscrire à un produit",
        request=InsurancePolicySerializer,
        responses={201: InsurancePolicySerializer}
    )
    def post(self, request):
        serializer = InsurancePolicySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        policy = serializer.save(client=request.user)
        return Response(InsurancePolicySerializer(policy).data, status=status.HTTP_201_CREATED)

class MyPoliciesView(APIView):
    permission_classes = [IsAuthenticated, IsClient]

    @extend_schema(
        tags=['Assurance'],
        summary="Mes polices actives",
        responses={200: InsurancePolicySerializer(many=True)}
    )
    def get(self, request):
        policies = InsurancePolicy.objects.filter(client=request.user)
        return Response(InsurancePolicySerializer(policies, many=True).data)

class AllPoliciesView(APIView):
    permission_classes = [IsAuthenticated, IsAgentOrAdmin]

    @extend_schema(
        tags=['Assurance'],
        summary="Toutes les polices",
        description="Réservé aux agents et administrateurs.",
        responses={200: InsurancePolicySerializer(many=True)}
    )
    def get(self, request):
        policies = InsurancePolicy.objects.all()
        return Response(InsurancePolicySerializer(policies, many=True).data)


class PolicyResilierView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    @extend_schema(
        tags=['Assurance'],
        summary="Résilier une police",
        description="Réservé aux administrateurs.",
        responses={200: InsurancePolicySerializer}
    )
    def patch(self, request, pk):
        try:
            policy = InsurancePolicy.objects.get(pk=pk)
        except InsurancePolicy.DoesNotExist:
            return Response({'error': 'Police introuvable.'}, status=status.HTTP_404_NOT_FOUND)

        if policy.statut != PolicyStatus.ACTIVE:
            return Response({'error': 'Seules les polices actives peuvent être résiliées.'}, status=status.HTTP_400_BAD_REQUEST)

        policy.statut = PolicyStatus.RESILIEE
        policy.save()
        return Response(InsurancePolicySerializer(policy).data)


class ProductManageView(APIView):
    """Créer un produit d'assurance — réservé aux ADMIN."""

    permission_classes = [IsAuthenticated, IsAdmin]

    @extend_schema(
        tags=['Assurance'],
        summary="Créer un produit d'assurance",
        request=InsuranceProductSerializer,
        responses={201: InsuranceProductSerializer},
    )
    def post(self, request):
        serializer = InsuranceProductSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        product = serializer.save()
        return Response(InsuranceProductSerializer(product).data, status=status.HTTP_201_CREATED)


class ProductDetailView(APIView):
    """Modifier ou supprimer un produit d'assurance — réservé aux ADMIN."""

    permission_classes = [IsAuthenticated, IsAdmin]

    def _get_product(self, pk):
        try:
            return InsuranceProduct.objects.get(pk=pk)
        except InsuranceProduct.DoesNotExist:
            return None

    @extend_schema(tags=['Assurance'], summary="Modifier un produit", responses={200: InsuranceProductSerializer})
    def patch(self, request, pk):
        product = self._get_product(pk)
        if not product:
            return Response({'error': 'Produit introuvable.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = InsuranceProductSerializer(product, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    @extend_schema(tags=['Assurance'], summary="Supprimer un produit")
    def delete(self, request, pk):
        product = self._get_product(pk)
        if not product:
            return Response({'error': 'Produit introuvable.'}, status=status.HTTP_404_NOT_FOUND)
        product.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
