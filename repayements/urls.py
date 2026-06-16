from django.urls import path
from .views.repayement_views import PaymentView, HistoryView, OverdueView
from .views.payment_request_views import (
    PaymentRequestCreateView,
    PaymentRequestListView,
    PaymentRequestDetailView,
    PaymentRequestValidateView,
    PaymentRequestRejectView,
)

urlpatterns = [
    # Paiements directs (agents/admins)
    path('pay/', PaymentView.as_view(), name='repayment-pay'),
    path('history/<int:client_id>/', HistoryView.as_view(), name='repayment-history'),
    path('overdue/', OverdueView.as_view(), name='repayment-overdue'),

    # Demandes de paiement (clients → agents)
    path('requests/', PaymentRequestListView.as_view(), name='payment-request-list'),
    path('requests/create/', PaymentRequestCreateView.as_view(), name='payment-request-create'),
    path('requests/<int:pk>/', PaymentRequestDetailView.as_view(), name='payment-request-detail'),
    path('requests/<int:pk>/validate/', PaymentRequestValidateView.as_view(), name='payment-request-validate'),
    path('requests/<int:pk>/reject/', PaymentRequestRejectView.as_view(), name='payment-request-reject'),
]
