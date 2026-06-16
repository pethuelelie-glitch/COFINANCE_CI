from django import template
from account.models import CustomUser
from credit.models import CreditRequest, RepaymentSchedule
from insurance.models import InsurancePolicy
from notification.models import Notification
from chat.models import Conversation

register = template.Library()


@register.simple_tag
def get_admin_stats():
    return {
        'nb_clients':         CustomUser.objects.filter(role='CLIENT').count(),
        'nb_agents':          CustomUser.objects.filter(role='AGENT').count(),
        'credits_en_attente': CreditRequest.objects.filter(statut__in=['SOUMISE', 'EN_ANALYSE']).count(),
        'credits_actifs':     CreditRequest.objects.filter(statut__in=['APPROUVEE', 'DECAISSEE']).count(),
        'credits_rejetes':    CreditRequest.objects.filter(statut='REJETEE').count(),
        'credits_total':      CreditRequest.objects.count(),
        'echeances_retard':   RepaymentSchedule.objects.filter(statut='EN_RETARD').count(),
        'echeances_pending':  RepaymentSchedule.objects.filter(statut='EN_ATTENTE').count(),
        'polices_actives':    InsurancePolicy.objects.filter(statut='ACTIVE').count(),
        'notifs_non_lues':    Notification.objects.filter(lu=False).count(),
        'convs_ouvertes':     Conversation.objects.filter(statut__in=['OUVERTE', 'EN_COURS']).count(),
    }