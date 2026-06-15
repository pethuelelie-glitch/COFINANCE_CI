from .models import Notification, NotificationType


class NotificationService:
    """Service centralisé de création de notifications."""

    @staticmethod
    def create(destinataire, type_notif, titre, message):
        return Notification.objects.create(
            destinataire=destinataire,
            type_notif=type_notif,
            titre=titre,
            message=message,
        )

    @staticmethod
    def notify_credit_status(credit):
        return NotificationService.create(
            destinataire=credit.client,
            type_notif=NotificationType.CREDIT_STATUT,
            titre='Mise à jour de votre demande de crédit',
            message=(
                f'Le statut de votre demande #{credit.id} '
                f'est passé à {credit.get_statut_display()}.'
            ),
        )

    @staticmethod
    def notify_payment(payment):
        return NotificationService.create(
            destinataire=payment.echeance.credit.client,
            type_notif=NotificationType.REMBOURSEMENT,
            titre='Paiement reçu',
            message=(
                f'Paiement de {payment.montant_paye} FCFA enregistré '
                f'pour l\'échéance n°{payment.echeance.numero_echeance}.'
            ),
        )

    @staticmethod
    def notify_echeance_reminder(echeance, jours_restants):
        return NotificationService.create(
            destinataire=echeance.credit.client,
            type_notif=NotificationType.REMBOURSEMENT,
            titre='Rappel d\'échéance',
            message=(
                f'Votre échéance n°{echeance.numero_echeance} '
                f'({echeance.montant_du} FCFA) arrive dans {jours_restants} jour(s).'
            ),
        )

    @staticmethod
    def notify_echeance_overdue(echeance):
        return NotificationService.create(
            destinataire=echeance.credit.client,
            type_notif=NotificationType.REMBOURSEMENT,
            titre='Échéance en retard',
            message=(
                f'L\'échéance n°{echeance.numero_echeance} '
                f'({echeance.montant_du} FCFA) est en retard.'
            ),
        )

    @staticmethod
    def notify_insurance_expiration(policy, jours_restants):
        return NotificationService.create(
            destinataire=policy.client,
            type_notif=NotificationType.ASSURANCE_EXPIRATION,
            titre='Expiration prochaine de votre assurance',
            message=(
                f'Votre police {policy.produit.nom} expire dans {jours_restants} jour(s).'
            ),
        )

    @staticmethod
    def notify_support_message(conversation, recipient):
        return NotificationService.create(
            destinataire=recipient,
            type_notif=NotificationType.SUPPORT_MESSAGE,
            titre='Nouveau message support',
            message=f'Nouveau message dans la conversation #{conversation.id}.',
        )
