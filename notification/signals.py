from django.db.models.signals import pre_save, post_save
from django.dispatch import receiver

from credit.models import CreditRequest
from repayements.models import Payment
from insurance.models import InsurancePolicy
from chat.models import Message
from notification.models import NotificationType
from notification.services import NotificationService


@receiver(pre_save, sender=CreditRequest)
def store_previous_credit_status(sender, instance, **kwargs):
    if instance.pk:
        try:
            instance._previous_statut = CreditRequest.objects.get(pk=instance.pk).statut
        except CreditRequest.DoesNotExist:
            instance._previous_statut = None
    else:
        instance._previous_statut = None


@receiver(post_save, sender=CreditRequest)
def notify_credit_status_change(sender, instance, created, **kwargs):
    if created:
        return
    previous = getattr(instance, '_previous_statut', None)
    if previous and previous != instance.statut:
        NotificationService.notify_credit_status(instance)


@receiver(post_save, sender=Payment)
def notify_payment_received(sender, instance, created, **kwargs):
    if created:
        NotificationService.notify_payment(instance)


@receiver(post_save, sender=InsurancePolicy)
def notify_insurance_created(sender, instance, created, **kwargs):
    if created:
        NotificationService.create(
            destinataire=instance.client,
            type_notif=NotificationType.ASSURANCE_SOUSCRIPTION,
            titre='Souscription assurance confirmée',
            message=f'Votre police {instance.produit.nom} est active jusqu\'au {instance.date_fin}.',
        )


@receiver(post_save, sender=Message)
def notify_chat_message(sender, instance, created, **kwargs):
    if not created:
        return
    conversation = instance.conversation
    if instance.auteur_id == conversation.client_id:
        if conversation.agent:
            NotificationService.notify_support_message(conversation, conversation.agent)
        else:
            from account.models import CustomUser, UserRole
            for agent in CustomUser.objects.filter(role=UserRole.AGENT)[:3]:
                NotificationService.notify_support_message(conversation, agent)
    else:
        NotificationService.notify_support_message(conversation, conversation.client)
