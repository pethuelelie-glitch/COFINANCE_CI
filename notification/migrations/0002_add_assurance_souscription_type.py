from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('notification', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='notification',
            name='type_notif',
            field=models.CharField(
                choices=[
                    ('CREDIT_STATUT', 'Statut Crédit'),
                    ('REMBOURSEMENT', 'Remboursement'),
                    ('ASSURANCE_SOUSCRIPTION', 'Souscription Assurance'),
                    ('ASSURANCE_EXPIRATION', 'Expiration Assurance'),
                    ('SUPPORT_MESSAGE', 'Message Support'),
                ],
                max_length=50,
                verbose_name='Type',
            ),
        ),
    ]
