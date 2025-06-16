using CollaborativeDrawing.ServerApp.Data;
using CollaborativeDrawing.ServerApp.Models;
using Microsoft.AspNetCore.SignalR;

namespace CollaborativeDrawing.ServerApp.Hubs
{
    public class ChatHub : Hub
    {     
        private readonly ILogger<DrawingHub> _logger;
        private readonly SessionDataStore _sessionDataStore;
        public ChatHub(ILogger<DrawingHub> logger, SessionDataStore sessionDataStore)
        {
            _logger = logger;
            _sessionDataStore = sessionDataStore;
        }
        public override async Task OnConnectedAsync()
        {
            string? sessionId = Context.GetHttpContext()?.Request.Query["sessionId"];
            if (!string.IsNullOrEmpty(sessionId))
            {
                if (!_sessionDataStore.DoesChatExist(sessionId))
                {
                    await _sessionDataStore.LoadChatData(sessionId); 
                }
                await Clients.Caller.SendAsync("LoadExistingMessages", _sessionDataStore.GetMessages(sessionId));
            }
            await base.OnConnectedAsync();
        }

        public async Task SendMessage(string sessionId, string senderId, string senderName, string message)
        {
            var chatMessage = new ChatMessage
            {
                Id = Guid.NewGuid().ToString(),
                SenderId = senderId,
                SenderName = senderName,
                Message = message,
                SessionId = sessionId
            };

            _sessionDataStore.AddMessage(sessionId, chatMessage);
            await Clients.Group(sessionId).SendAsync("ReceiveMessage", chatMessage);
        }

        public async Task JoinSession(string sessionId, string userId)
        {
            try
            {
                _sessionDataStore.AddChatUser(Context.ConnectionId, sessionId, userId);
                await Groups.AddToGroupAsync(Context.ConnectionId, sessionId);
            }
            catch (Exception ex)
            {
                _logger.LogInformation($"Ошибка в JoinSession: {ex.Message}");
                throw;
            }
        }

        public async Task LeaveSession(string sessionId)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, sessionId);
        }

        public async Task RemoveUserFromChat(string sessionId, string userId)
        {
            string connectionId = _sessionDataStore.GetConnectionChatId(sessionId, userId);
            await Groups.RemoveFromGroupAsync(connectionId, sessionId);
        }
        public async Task EndSession(string sessionId)
        {
            var connectionIds = _sessionDataStore.RemoveAllChatUsersFromSession(sessionId);
            foreach (var connectionId in connectionIds)
            {
                await Groups.RemoveFromGroupAsync(connectionId, sessionId);
            }
        }
    }
}
