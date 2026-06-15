from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from .models import CreditRequest, CreditStatus, RepaymentSchedule


class CreditService:
    """Logique métier pour les microcrédits."""

    INTERET_ANNUEL = 0.12
    DUREE_MOIS_DEFAUT = 12

    @classmethod
    def calculate_eligibility_score(cls, credit: CreditRequest) -> float:
        """Score basé sur l'historique, le montant demandé et les retards actifs."""
        score = 50.0

        rembourses = CreditRequest.objects.filter(
            client=credit.client,
            statut=CreditStatus.DECAISSEE,
        ).count()
        score += rembourses * 10

        total_decaisse = CreditRequest.objects.filter(
            client=credit.client,
            statut=CreditStatus.DECAISSEE,
        ).values_list('montant_demande', flat=True)
        historique_total = sum(total_decaisse) or 0
        if historique_total > 0 and credit.montant_demande > historique_total * 2:
            score -= 15

        retards_actifs = RepaymentSchedule.objects.filter(
            credit__client=credit.client,
            statut=RepaymentSchedule.Status.EN_RETARD,
        ).exists()
        if retards_actifs:
            score -= 20

        return min(max(score, 0.0), 100.0)

    @classmethod
    @transaction.atomic
    def generate_repayment_schedule(
        cls,
        credit: CreditRequest,
        duree_mois: int | None = None,
    ) -> list[RepaymentSchedule]:
        """Génère l'échéancier mensuel avec intérêts répartis."""
        if credit.schedules.exists():
            return list(credit.schedules.all())

        duree = duree_mois or getattr(credit, 'duree_mois', None) or cls.DUREE_MOIS_DEFAUT
        # taux_interet est stocké en pourcentage (ex: 12.0 = 12%) → on divise par 100
        taux_pct = getattr(credit, 'taux_interet', None) or (cls.INTERET_ANNUEL * 100)
        taux = taux_pct / 100
        montant = credit.montant_demande
        interets_totaux = int(montant * taux * (duree / 12))
        montant_total = montant + interets_totaux
        montant_mensuel = montant_total // duree
        reste = montant_total - (montant_mensuel * duree)

        schedules = []
        today = timezone.now().date()
        for i in range(1, duree + 1):
            du = montant_mensuel + (reste if i == duree else 0)
            schedules.append(
                RepaymentSchedule.objects.create(
                    credit=credit,
                    numero_echeance=i,
                    date_echeance=today + timedelta(days=30 * i),
                    montant_du=du,
                )
            )
        return schedules

    @classmethod
    @transaction.atomic
    def update_status(cls, credit: CreditRequest, new_status: str, agent) -> CreditRequest:
        credit.statut = new_status
        if new_status in (CreditStatus.APPROUVEE, CreditStatus.REJETEE, CreditStatus.DECAISSEE):
            credit.date_decision = timezone.now()
            credit.agent = agent
        credit.save()

        if new_status in (CreditStatus.APPROUVEE, CreditStatus.DECAISSEE):
            cls.generate_repayment_schedule(credit)

        return credit
