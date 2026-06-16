from django.contrib import admin
from django.utils.html import mark_safe, format_html
from django.utils.translation import gettext_lazy as _

from credit.models import CreditRequest, RepaymentSchedule
from repayements.models import Payment, PaymentRequest
from insurance.models import InsuranceProduct, InsurancePolicy
from notification.models import Notification
from chat.models import Conversation, Message


# ─── Site global ─────────────────────────────────────────────────────────────
admin.site.site_header = "COFINANCE CI — Administration"
admin.site.site_title  = "COFINANCE CI Admin"
admin.site.index_title = "Tableau de bord"


# ─── Helpers badges ──────────────────────────────────────────────────────────
_CREDIT_COLORS = {
    'SOUMISE':    'blue',
    'EN_ANALYSE': 'yellow',
    'APPROUVEE':  'green',
    'DECAISSEE':  'purple',
    'REJETEE':    'red',
}
_ECHEANCE_COLORS = {
    'EN_ATTENTE': 'yellow',
    'PAYEE':      'green',
    'EN_RETARD':  'red',
}
_CONV_COLORS = {
    'OUVERTE':  'blue',
    'EN_COURS': 'yellow',
    'FERMEE':   'gray',
}
_POLICY_COLORS = {
    'ACTIVE':   'green',
    'EXPIREE':  'gray',
    'RESILIEE': 'red',
}


def badge(text, color):
    return format_html(
        '<span class="badge badge-{}">{}</span>', color, text
    )


def fmt_money(value):
    if value is None:
        return '—'
    return format_html(
        '<span style="font-weight:600;font-variant-numeric:tabular-nums">{} FCFA</span>',
        f'{value:,}'.replace(',', ' ')
    )


# ─── Inlines ─────────────────────────────────────────────────────────────────
class RepaymentScheduleInline(admin.TabularInline):
    model = RepaymentSchedule
    extra = 0
    fields = ['numero_echeance', 'date_echeance', 'montant_du', 'statut']
    readonly_fields = ['numero_echeance', 'date_echeance', 'montant_du', 'statut']
    can_delete = False
    show_change_link = True
    verbose_name = "Échéance"
    verbose_name_plural = "Échéancier"


class PaymentInline(admin.TabularInline):
    model = Payment
    extra = 0
    fields = ['montant_paye', 'penalites', 'interets', 'date_paiement', 'agent']
    readonly_fields = ['montant_paye', 'penalites', 'interets', 'date_paiement', 'agent']
    can_delete = False
    verbose_name = "Paiement"
    verbose_name_plural = "Paiements"


class MessageInline(admin.TabularInline):
    model = Message
    extra = 0
    fields = ['auteur', 'contenu_court', 'timestamp', 'lu']
    readonly_fields = ['auteur', 'contenu_court', 'timestamp', 'lu']
    can_delete = False
    show_change_link = True
    verbose_name = "Message"
    verbose_name_plural = "Messages"

    def contenu_court(self, obj):
        return obj.contenu[:80] + ('…' if len(obj.contenu) > 80 else '')
    contenu_court.short_description = "Contenu"


# ─── CreditRequest ────────────────────────────────────────────────────────────
def action_approuver(modeladmin, request, queryset):
    queryset.filter(statut='SOUMISE').update(statut='APPROUVEE')
action_approuver.short_description = "Approuver les demandes sélectionnées"

def action_rejeter(modeladmin, request, queryset):
    queryset.filter(statut__in=['SOUMISE', 'EN_ANALYSE']).update(statut='REJETEE')
action_rejeter.short_description = "Rejeter les demandes sélectionnées"

def action_en_analyse(modeladmin, request, queryset):
    queryset.filter(statut='SOUMISE').update(statut='EN_ANALYSE')
action_en_analyse.short_description = "Passer en analyse"


@admin.register(CreditRequest)
class CreditRequestAdmin(admin.ModelAdmin):
    list_display  = ['id', 'client_email', 'montant_badge', 'duree_mois',
                     'statut_badge', 'score_pct', 'agent', 'date_soumission']
    list_filter   = ['statut', 'duree_mois', ('date_soumission', admin.DateFieldListFilter)]
    search_fields = ['client__email', 'client__first_name', 'client__last_name', 'motif']
    ordering      = ['-date_soumission']
    actions       = [action_approuver, action_rejeter, action_en_analyse]
    date_hierarchy = 'date_soumission'
    list_per_page = 25
    inlines       = [RepaymentScheduleInline]

    readonly_fields = ['date_soumission', 'date_decision', 'score_eligibilite']

    fieldsets = (
        ('Demande', {
            'fields': ('client', 'agent', 'statut', 'date_soumission', 'date_decision')
        }),
        ('Montant & conditions', {
            'fields': ('montant_demande', 'duree_mois', 'taux_interet', 'score_eligibilite')
        }),
        ('Description', {
            'fields': ('motif', 'description', 'pieces_justificatives'),
            'classes': ('collapse',),
        }),
    )

    def client_email(self, obj):
        return obj.client.email if obj.client else '—'
    client_email.short_description = "Client"
    client_email.admin_order_field = 'client__email'

    def montant_badge(self, obj):
        return fmt_money(obj.montant_demande)
    montant_badge.short_description = "Montant"
    montant_badge.admin_order_field = 'montant_demande'

    def statut_badge(self, obj):
        labels = {
            'SOUMISE': 'Soumise', 'EN_ANALYSE': 'En analyse',
            'APPROUVEE': 'Approuvée', 'DECAISSEE': 'Décaissée', 'REJETEE': 'Rejetée',
        }
        return badge(labels.get(obj.statut, obj.statut), _CREDIT_COLORS.get(obj.statut, 'gray'))
    statut_badge.short_description = "Statut"
    statut_badge.admin_order_field = 'statut'

    def score_pct(self, obj):
        score = obj.score_eligibilite or 0
        color = '#065f46' if score >= 70 else ('#92400e' if score >= 40 else '#991b1b')
        return format_html(
            '<span style="font-weight:700;color:{}">{:.0f}%</span>', color, score
        )
    score_pct.short_description = "Score"
    score_pct.admin_order_field = 'score_eligibilite'


# ─── RepaymentSchedule ────────────────────────────────────────────────────────
@admin.register(RepaymentSchedule)
class RepaymentScheduleAdmin(admin.ModelAdmin):
    list_display  = ['id', 'credit_link', 'numero_echeance', 'date_echeance',
                     'montant_badge', 'statut_badge']
    list_filter   = ['statut', ('date_echeance', admin.DateFieldListFilter)]
    search_fields = ['credit__client__email', 'credit__id']
    ordering      = ['date_echeance']
    list_per_page = 30
    inlines       = [PaymentInline]

    def credit_link(self, obj):
        return format_html(
            '<a href="/admin/credit/creditrequest/{}/change/">Crédit #{}</a>',
            obj.credit_id, obj.credit_id
        )
    credit_link.short_description = "Crédit"

    def montant_badge(self, obj):
        return fmt_money(obj.montant_du)
    montant_badge.short_description = "Montant dû"
    montant_badge.admin_order_field = 'montant_du'

    def statut_badge(self, obj):
        labels = {'EN_ATTENTE': 'En attente', 'PAYEE': 'Payée', 'EN_RETARD': 'En retard'}
        return badge(labels.get(obj.statut, obj.statut), _ECHEANCE_COLORS.get(obj.statut, 'gray'))
    statut_badge.short_description = "Statut"
    statut_badge.admin_order_field = 'statut'


# ─── Payment ─────────────────────────────────────────────────────────────────
@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display  = ['id', 'echeance_link', 'montant_badge', 'penalites_fmt',
                     'interets_fmt', 'agent', 'date_paiement']
    list_filter   = [('date_paiement', admin.DateFieldListFilter)]
    search_fields = ['echeance__credit__client__email', 'agent__email']
    ordering      = ['-date_paiement']
    readonly_fields = ['date_paiement', 'penalites', 'interets']
    date_hierarchy = 'date_paiement'
    list_per_page = 30

    def echeance_link(self, obj):
        return format_html(
            '<a href="/admin/credit/repaymentschedule/{}/change/">Échéance #{}</a>',
            obj.echeance_id, obj.echeance_id
        )
    echeance_link.short_description = "Échéance"

    def montant_badge(self, obj):
        return fmt_money(obj.montant_paye)
    montant_badge.short_description = "Montant payé"
    montant_badge.admin_order_field = 'montant_paye'

    def penalites_fmt(self, obj):
        if obj.penalites:
            return format_html('<span style="color:#991b1b;font-weight:600">{} FCFA</span>', obj.penalites)
        return '—'
    penalites_fmt.short_description = "Pénalités"

    def interets_fmt(self, obj):
        return fmt_money(obj.interets) if obj.interets else '—'
    interets_fmt.short_description = "Intérêts"


# ─── PaymentRequest ──────────────────────────────────────────────────────────
_PR_COLORS = {
    'EN_ATTENTE': 'yellow',
    'VALIDEE':    'green',
    'REJETEE':    'red',
}
_PR_LABELS = {
    'EN_ATTENTE': 'En attente',
    'VALIDEE':    'Validée',
    'REJETEE':    'Rejetée',
}
_PR_MODE = {
    'MOBILE_MONEY': 'Mobile Money',
    'ESPECES':      'Espèces',
    'VIREMENT':     'Virement',
}


def action_valider_pr(modeladmin, request, queryset):
    from repayements.models import Payment as Pmt
    for pr in queryset.filter(statut='EN_ATTENTE'):
        payment = Pmt.objects.create(echeance=pr.echeance, montant_paye=pr.montant, agent=request.user)
        pr.statut = 'VALIDEE'
        pr.agent_validateur = request.user
        pr.payment = payment
        pr.save()
action_valider_pr.short_description = "Valider les demandes sélectionnées"


def action_rejeter_pr(modeladmin, request, queryset):
    queryset.filter(statut='EN_ATTENTE').update(statut='REJETEE', agent_validateur=request.user)
action_rejeter_pr.short_description = "Rejeter les demandes sélectionnées"


@admin.register(PaymentRequest)
class PaymentRequestAdmin(admin.ModelAdmin):
    list_display   = ['id', 'client', 'echeance_link', 'montant_fmt', 'mode_label',
                      'statut_badge', 'agent_validateur', 'created_at']
    list_filter    = ['statut', 'mode_paiement', ('created_at', admin.DateFieldListFilter)]
    search_fields  = ['client__email', 'client__first_name', 'reference_transaction']
    ordering       = ['-created_at']
    actions        = [action_valider_pr, action_rejeter_pr]
    date_hierarchy = 'created_at'
    list_per_page  = 30
    readonly_fields = ['created_at', 'updated_at', 'payment', 'agent_validateur']

    fieldsets = (
        ('Demande', {
            'fields': ('client', 'echeance', 'montant', 'mode_paiement', 'reference_transaction', 'note_client'),
        }),
        ('Décision agent', {
            'fields': ('statut', 'agent_validateur', 'note_agent', 'payment'),
        }),
        ('Dates', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )

    def echeance_link(self, obj):
        return format_html(
            '<a href="/admin/credit/repaymentschedule/{}/change/">Échéance #{} — Crédit #{}</a>',
            obj.echeance_id, obj.echeance.numero_echeance, obj.echeance.credit_id,
        )
    echeance_link.short_description = "Échéance"

    def montant_fmt(self, obj):
        return fmt_money(obj.montant)
    montant_fmt.short_description = "Montant"
    montant_fmt.admin_order_field = 'montant'

    def mode_label(self, obj):
        return _PR_MODE.get(obj.mode_paiement, obj.mode_paiement)
    mode_label.short_description = "Mode"

    def statut_badge(self, obj):
        return badge(_PR_LABELS.get(obj.statut, obj.statut), _PR_COLORS.get(obj.statut, 'gray'))
    statut_badge.short_description = "Statut"
    statut_badge.admin_order_field = 'statut'


# ─── InsuranceProduct ─────────────────────────────────────────────────────────
@admin.register(InsuranceProduct)
class InsuranceProductAdmin(admin.ModelAdmin):
    list_display  = ['nom', 'type_badge', 'prime_fmt', 'couverture_fmt']
    list_filter   = ['type_produit']
    search_fields = ['nom', 'description']
    ordering      = ['nom']

    fieldsets = (
        (None, {'fields': ('nom', 'type_produit', 'description')}),
        ('Financier', {'fields': ('prime_mensuelle', 'couverture_max')}),
    )

    def type_badge(self, obj):
        colors = {'VIE': 'green', 'DECES_INVALIDITE': 'red'}
        labels = {'VIE': 'Assurance Vie', 'DECES_INVALIDITE': 'Décès & Invalidité'}
        return badge(labels.get(obj.type_produit, obj.type_produit), colors.get(obj.type_produit, 'gray'))
    type_badge.short_description = "Type"

    def prime_fmt(self, obj):
        return fmt_money(obj.prime_mensuelle)
    prime_fmt.short_description = "Prime/mois"

    def couverture_fmt(self, obj):
        return fmt_money(obj.couverture_max)
    couverture_fmt.short_description = "Couverture max"


# ─── InsurancePolicy ─────────────────────────────────────────────────────────
def action_resilier_police(modeladmin, request, queryset):
    queryset.filter(statut='ACTIVE').update(statut='RESILIEE')
action_resilier_police.short_description = "Résilier les polices sélectionnées"


@admin.register(InsurancePolicy)
class InsurancePolicyAdmin(admin.ModelAdmin):
    list_display  = ['id', 'client_email', 'produit', 'date_debut', 'date_fin', 'statut_badge']
    list_filter   = ['statut', 'produit']
    search_fields = ['client__email', 'produit__nom']
    ordering      = ['-date_debut']
    actions       = [action_resilier_police]
    date_hierarchy = 'date_debut'

    def client_email(self, obj):
        return obj.client.email
    client_email.short_description = "Client"
    client_email.admin_order_field = 'client__email'

    def statut_badge(self, obj):
        labels = {'ACTIVE': 'Active', 'EXPIREE': 'Expirée', 'RESILIEE': 'Résiliée'}
        return badge(labels.get(obj.statut, obj.statut), _POLICY_COLORS.get(obj.statut, 'gray'))
    statut_badge.short_description = "Statut"
    statut_badge.admin_order_field = 'statut'


# ─── Notification ─────────────────────────────────────────────────────────────
def action_marquer_lues(modeladmin, request, queryset):
    queryset.update(lu=True)
action_marquer_lues.short_description = "Marquer comme lues"

def action_marquer_non_lues(modeladmin, request, queryset):
    queryset.update(lu=False)
action_marquer_non_lues.short_description = "Marquer comme non lues"


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display  = ['id', 'destinataire_email', 'type_badge', 'titre', 'lu_badge', 'created_at']
    list_filter   = ['type_notif', 'lu', ('created_at', admin.DateFieldListFilter)]
    search_fields = ['destinataire__email', 'titre', 'message']
    ordering      = ['-created_at']
    actions       = [action_marquer_lues, action_marquer_non_lues]
    date_hierarchy = 'created_at'
    list_per_page = 40
    readonly_fields = ['created_at']

    _TYPE_COLORS = {
        'CREDIT_STATUT':          'blue',
        'REMBOURSEMENT':          'green',
        'ASSURANCE_SOUSCRIPTION': 'purple',
        'ASSURANCE_EXPIRATION':   'yellow',
        'SUPPORT_MESSAGE':        'gray',
    }
    _TYPE_LABELS = {
        'CREDIT_STATUT':          'Crédit',
        'REMBOURSEMENT':          'Remboursement',
        'ASSURANCE_SOUSCRIPTION': 'Souscription',
        'ASSURANCE_EXPIRATION':   'Expiration',
        'SUPPORT_MESSAGE':        'Support',
    }

    def destinataire_email(self, obj):
        return obj.destinataire.email
    destinataire_email.short_description = "Destinataire"
    destinataire_email.admin_order_field = 'destinataire__email'

    def type_badge(self, obj):
        return badge(
            self._TYPE_LABELS.get(obj.type_notif, obj.type_notif),
            self._TYPE_COLORS.get(obj.type_notif, 'gray')
        )
    type_badge.short_description = "Type"
    type_badge.admin_order_field = 'type_notif'

    def lu_badge(self, obj):
        if obj.lu:
            return format_html('<span class="badge badge-green">Lue</span>')
        return format_html('<span class="badge badge-yellow">Non lue</span>')
    lu_badge.short_description = "Lu"
    lu_badge.admin_order_field = 'lu'


# ─── Conversation ─────────────────────────────────────────────────────────────
def action_fermer_conversation(modeladmin, request, queryset):
    queryset.update(statut='FERMEE')
action_fermer_conversation.short_description = "Fermer les conversations sélectionnées"


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display  = ['id', 'client_email', 'agent_email', 'statut_badge',
                     'nb_messages', 'updated_at']
    list_filter   = ['statut', ('created_at', admin.DateFieldListFilter)]
    search_fields = ['client__email', 'agent__email']
    ordering      = ['-updated_at']
    actions       = [action_fermer_conversation]
    readonly_fields = ['created_at', 'updated_at']
    inlines       = [MessageInline]

    def client_email(self, obj):
        return obj.client.email
    client_email.short_description = "Client"
    client_email.admin_order_field = 'client__email'

    def agent_email(self, obj):
        return obj.agent.email if obj.agent else format_html('<span style="color:#9ca3af">—</span>')
    agent_email.short_description = "Agent"
    agent_email.admin_order_field = 'agent__email'

    def statut_badge(self, obj):
        labels = {'OUVERTE': 'Ouverte', 'EN_COURS': 'En cours', 'FERMEE': 'Fermée'}
        return badge(labels.get(obj.statut, obj.statut), _CONV_COLORS.get(obj.statut, 'gray'))
    statut_badge.short_description = "Statut"
    statut_badge.admin_order_field = 'statut'

    def nb_messages(self, obj):
        count = obj.messages.count()
        return format_html('<span style="font-weight:600">{}</span>', count)
    nb_messages.short_description = "Messages"


# ─── Message ─────────────────────────────────────────────────────────────────
@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display  = ['id', 'conversation_link', 'auteur_email', 'contenu_court', 'lu_badge', 'timestamp']
    list_filter   = ['lu', ('timestamp', admin.DateFieldListFilter)]
    search_fields = ['auteur__email', 'contenu']
    ordering      = ['-timestamp']
    readonly_fields = ['timestamp']
    date_hierarchy = 'timestamp'
    list_per_page = 40

    def conversation_link(self, obj):
        return format_html(
            '<a href="/admin/chat/conversation/{}/change/">Conv #{}</a>',
            obj.conversation_id, obj.conversation_id
        )
    conversation_link.short_description = "Conversation"

    def auteur_email(self, obj):
        return obj.auteur.email
    auteur_email.short_description = "Auteur"
    auteur_email.admin_order_field = 'auteur__email'

    def contenu_court(self, obj):
        return obj.contenu[:60] + ('…' if len(obj.contenu) > 60 else '')
    contenu_court.short_description = "Message"

    def lu_badge(self, obj):
        if obj.lu:
            return format_html('<span class="badge badge-green">Lu</span>')
        return format_html('<span class="badge badge-yellow">Non lu</span>')
    lu_badge.short_description = "Lu"
    lu_badge.admin_order_field = 'lu'
