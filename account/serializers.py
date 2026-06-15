# Module 01 — Accounts : Serializers


from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password

from .models import CustomUser


class RegisterSerializer(serializers.ModelSerializer):
    """Serializer pour l'inscription d'un nouveau client."""

    password = serializers.CharField(
        write_only=True,
        required=True,
        validators=[validate_password],
        style={'input_type': 'password'},
    )
    password_confirm = serializers.CharField(
        write_only=True,
        required=True,
        style={'input_type': 'password'},
    )

    class Meta:
        model = CustomUser
        fields = [
            'id', 'email', 'first_name', 'last_name',
            'phone', 'adresse', 'ville', 'region', 'date_naissance',
            'password', 'password_confirm',
        ]
        extra_kwargs = {
            'first_name': {'required': True},
            'last_name': {'required': True},
        }

    def validate(self, attrs):
        if attrs['password'] != attrs.pop('password_confirm'):
            raise serializers.ValidationError(
                {'password_confirm': "Les mots de passe ne correspondent pas."}
            )
        return attrs

    def create(self, validated_data):
        password = validated_data.pop('password')
        # Par défaut, un utilisateur créé via l'API est CLIENT
        validated_data['role'] = 'CLIENT'
        validated_data['username'] = validated_data['email']
        user = CustomUser(**validated_data)
        user.set_password(password)
        user.save()
        return user


class LoginSerializer(serializers.Serializer):
    """Serializer pour la connexion (email + password)."""

    email = serializers.EmailField()
    password = serializers.CharField(style={'input_type': 'password'}, write_only=True)

    def validate(self, attrs):
        user = authenticate(
            request=self.context.get('request'),
            username=attrs['email'],
            password=attrs['password'],
        )
        if not user:
            raise serializers.ValidationError(
                "Email ou mot de passe incorrect.",
                code='authorization'
            )
        if not user.is_active:
            raise serializers.ValidationError(
                "Ce compte est désactivé.",
                code='authorization'
            )
        attrs['user'] = user
        return attrs


class ProfileSerializer(serializers.ModelSerializer):
    """Serializer pour consulter et modifier le profil utilisateur."""

    role_display = serializers.CharField(source='get_role_display', read_only=True)
    date_naissance = serializers.DateField(required=False, allow_null=True)

    class Meta:
        model = CustomUser
        fields = [
            'id', 'email', 'first_name', 'last_name',
            'role', 'role_display', 'is_active',
            'phone', 'adresse', 'ville', 'region',
            'date_naissance', 'photo_profil',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'email', 'role', 'role_display', 'is_active', 'created_at', 'updated_at']

    def to_internal_value(self, data):
        # Convertir la chaîne vide en null pour les champs date
        mutable = data.copy() if hasattr(data, 'copy') else dict(data)
        if mutable.get('date_naissance') == '':
            mutable['date_naissance'] = None
        return super().to_internal_value(mutable)


class UserMinimalSerializer(serializers.ModelSerializer):
    """Serializer léger pour les références utilisateur dans d'autres modules."""

    full_name = serializers.CharField(source='get_full_name', read_only=True)

    class Meta:
        model = CustomUser
        fields = ['id', 'email', 'full_name', 'role', 'phone']
        read_only_fields = fields


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """JWT enrichi avec les informations utilisateur."""

    username_field = 'email'

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['role'] = user.role
        token['email'] = user.email
        token['full_name'] = user.get_full_name()
        return token

    def validate(self, attrs):
        # Remappe email → username pour simplejwt
        attrs['username'] = attrs.get('email', '')
        return super().validate(attrs)
