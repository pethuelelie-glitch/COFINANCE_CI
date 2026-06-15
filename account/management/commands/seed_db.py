"""
Commande seed_db — Initialisation des comptes système COFINANCE CI.
Crée l'admin, les agents et le catalogue de produits d'assurance.
"""

from django.core.management.base import BaseCommand
from django.db import transaction

from account.models import CustomUser, UserRole
from insurance.models import InsuranceProduct, ProductType


class Command(BaseCommand):
    help = 'Génère des données de démonstration réalistes pour COFINANCE CI.'

    @transaction.atomic
    def handle(self, *args, **options):
        self.stdout.write(self.style.HTTP_INFO('== COFINANCE CI — Génération des données de démonstration =='))

        # ── Admin ─────────────────────────────────────────────────────────────
        admin, created = CustomUser.objects.get_or_create(
            email='admin@cofci.ci',
            defaults={
                'username': 'admin@cofci.ci',
                'first_name': 'Administrateur',
                'last_name': 'Cofci',
                'role': UserRole.ADMIN,
                'is_staff': True,
                'is_superuser': True,
                'ville': 'Abidjan',
                'region': 'Lagunes',
            },
        )
        # Update name if old value still present from a previous seed
        if admin.first_name in ('Super', ''):
            admin.first_name = 'Administrateur'
            admin.last_name  = 'Cofci'
        admin.set_password('Admin1234!')
        admin.save()
        self.stdout.write(f'  {"Créé" if created else "Existant"} : admin@cofci.ci')

        # ── Agents ────────────────────────────────────────────────────────────
        agents_data = [
            {'first_name': 'Kouamé',  'last_name': 'Attié',    'region': 'Lagunes'},
            {'first_name': 'Séraphin','last_name': 'N\'Guessan','region': 'Gbêkê'},
            {'first_name': 'Lynda',   'last_name': 'Akaffou',  'region': 'Haut-Sassandra'},
        ]
        agents = []
        for i, ad in enumerate(agents_data, 1):
            email = f'agent{i}@cofci.ci'
            agent, created = CustomUser.objects.get_or_create(
                email=email,
                defaults={
                    'username': email,
                    'first_name': ad['first_name'],
                    'last_name': ad['last_name'],
                    'role': UserRole.AGENT,
                    'is_staff': True,
                    'ville': 'Abidjan',
                    'region': ad['region'],
                    'phone': f'+225070000{90 + i:02d}',
                },
            )
            agent.set_password('Agent1234!')
            agent.save()
            agents.append(agent)
            self.stdout.write(f'  {"Créé" if created else "Existant"} : {email}')

        # ── Produits d'assurance ───────────────────────────────────────────────
        prod_vie, _ = InsuranceProduct.objects.get_or_create(
            nom='Assurance Vie Essentielle',
            defaults={
                'description': 'Protection de base pour vous et votre famille.',
                'prime_mensuelle': 5000,
                'couverture_max': 1000000,
                'type_produit': ProductType.VIE,
            },
        )
        prod_deces, _ = InsuranceProduct.objects.get_or_create(
            nom='Protection Décès & Invalidité',
            defaults={
                'description': 'Couverture complète décès, accidents et invalidité.',
                'prime_mensuelle': 12000,
                'couverture_max': 5000000,
                'type_produit': ProductType.DECES_INVALIDITE,
            },
        )
        prod_premium, _ = InsuranceProduct.objects.get_or_create(
            nom='Assurance Vie Premium',
            defaults={
                'description': 'Notre offre la plus complète avec avantages exclusifs.',
                'prime_mensuelle': 25000,
                'couverture_max': 10000000,
                'type_produit': ProductType.VIE,
            },
        )
        self.stdout.write('  3 produits d\'assurance OK')

        self.stdout.write(self.style.SUCCESS('\n[OK] Initialisation terminée !\n'))
        self.stdout.write('Identifiants de connexion :')
        self.stdout.write('  Admin  : admin@cofci.ci   / Admin1234!')
        self.stdout.write('  Agent1 : agent1@cofci.ci  / Agent1234!')
        self.stdout.write('  Agent2 : agent2@cofci.ci  / Agent1234!')
        self.stdout.write('  Agent3 : agent3@cofci.ci  / Agent1234!')
