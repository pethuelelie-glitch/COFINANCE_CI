from django.contrib import admin
from credit.models import CreditRequest, RepaymentSchedule
from repayements.models import Payment
from insurance.models import InsuranceProduct, InsurancePolicy
from notification.models import Notification
from chat.models import Conversation, Message


@admin.register(CreditRequest)
class CreditRequestAdmin(admin.ModelAdmin):
    list_display = ['id', 'client', 'montant_demande', 'statut', 'score_eligibilite', 'date_soumission']
    list_filter = ['statut']
    search_fields = ['client__email', 'motif']


@admin.register(RepaymentSchedule)
class RepaymentScheduleAdmin(admin.ModelAdmin):
    list_display = ['id', 'credit', 'numero_echeance', 'date_echeance', 'montant_du', 'statut']
    list_filter = ['statut']


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ['id', 'echeance', 'montant_paye', 'penalites', 'interets', 'date_paiement']


@admin.register(InsuranceProduct)
class InsuranceProductAdmin(admin.ModelAdmin):
    list_display = ['nom', 'type_produit', 'prime_mensuelle', 'couverture_max']


@admin.register(InsurancePolicy)
class InsurancePolicyAdmin(admin.ModelAdmin):
    list_display = ['client', 'produit', 'date_debut', 'date_fin', 'statut']
    list_filter = ['statut']


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ['destinataire', 'type_notif', 'titre', 'lu', 'created_at']
    list_filter = ['type_notif', 'lu']


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ['id', 'client', 'agent', 'statut', 'updated_at']
    list_filter = ['statut']


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ['conversation', 'auteur', 'contenu', 'timestamp', 'lu']
