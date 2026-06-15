from django.urls import path
from .views.insurance_views import (
    ProductListView, SubscribeView, MyPoliciesView,
    AllPoliciesView, PolicyResilierView,
    ProductManageView, ProductDetailView,
)

urlpatterns = [
    path('products/', ProductListView.as_view(), name='insurance-products'),
    path('products/manage/', ProductManageView.as_view(), name='insurance-product-manage'),
    path('products/<int:pk>/', ProductDetailView.as_view(), name='insurance-product-detail'),
    path('subscribe/', SubscribeView.as_view(), name='insurance-subscribe'),
    path('policies/', MyPoliciesView.as_view(), name='insurance-my-policies'),
    path('policies/all/', AllPoliciesView.as_view(), name='insurance-all-policies'),
    path('policies/<int:pk>/resilier/', PolicyResilierView.as_view(), name='insurance-resilier'),
]
