from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta

from credit.models import RepaymentSchedule
from insurance.models import InsurancePolicy, PolicyStatus
from notification.services import NotificationService


class Command(BaseCommand):
    help = 'Vérifie les échéances et polices : rappels J-3, retards J+1, assurance J-15.'

    def handle(self, *args, **options):
        today = timezone.now().date()
        j3 = today + timedelta(days=3)
        j15 = today + timedelta(days=15)

        for echeance in RepaymentSchedule.objects.filter(
            statut=RepaymentSchedule.Status.EN_ATTENTE,
            date_echeance=j3,
        ):
            NotificationService.notify_echeance_reminder(echeance, 3)

        for echeance in RepaymentSchedule.objects.filter(
            statut=RepaymentSchedule.Status.EN_ATTENTE,
            date_echeance__lt=today,
        ):
            echeance.statut = RepaymentSchedule.Status.EN_RETARD
            echeance.save()
            NotificationService.notify_echeance_overdue(echeance)

        # Use a range so that missed days are still caught
        j1 = today + timedelta(days=1)
        for policy in InsurancePolicy.objects.filter(
            statut=PolicyStatus.ACTIVE,
            date_fin__range=(j1, j15),
        ):
            NotificationService.notify_insurance_expiration(policy, (policy.date_fin - today).days)

        self.stdout.write(self.style.SUCCESS('Vérification des alertes terminée.'))
