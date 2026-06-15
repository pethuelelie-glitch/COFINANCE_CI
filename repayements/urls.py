from django.urls import path
from .views.repayement_views import PaymentView, HistoryView, OverdueView

urlpatterns = [
    path('pay/', PaymentView.as_view(), name='repayment-pay'),
    path('history/<int:client_id>/', HistoryView.as_view(), name='repayment-history'),
    path('overdue/', OverdueView.as_view(), name='repayment-overdue'),
]
