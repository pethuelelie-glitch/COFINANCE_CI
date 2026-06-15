from django.urls import path
from chat.views import (
    ConversationListCreateView,
    ConversationMessagesView,
    ConversationAssignView,
    ConversationCloseView,
)

urlpatterns = [
    path('conversations/', ConversationListCreateView.as_view(), name='chat-conversations'),
    path('conversations/<int:pk>/messages/', ConversationMessagesView.as_view(), name='chat-messages'),
    path('conversations/<int:pk>/assign/', ConversationAssignView.as_view(), name='chat-assign'),
    path('conversations/<int:pk>/close/', ConversationCloseView.as_view(), name='chat-close'),
]
