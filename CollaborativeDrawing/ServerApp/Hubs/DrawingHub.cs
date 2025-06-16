using CollaborativeDrawing.ServerApp.Data;
using CollaborativeDrawing.ServerApp.Models;
using Microsoft.AspNetCore.SignalR;

namespace CollaborativeDrawing.ServerApp.Hubs 
{
    public class DrawingHub : Hub
    {
        private readonly ILogger<DrawingHub> _logger;
        private readonly SessionDataStore _sessionDataStore;

        public DrawingHub(ILogger<DrawingHub> logger, SessionDataStore sessionDataStore)
        {
            _logger = logger;
            _sessionDataStore = sessionDataStore;
        }

        public override async Task OnConnectedAsync()
        {
            string? sessionId = Context.GetHttpContext()?.Request.Query["sessionId"];
            if (!string.IsNullOrEmpty(sessionId))
            {
                if (!_sessionDataStore.DoesSessionExist(sessionId))
                {
                    await _sessionDataStore.LoadSessionData(sessionId);
                }
                await Clients.Caller.SendAsync("LoadExistingData", 
                    _sessionDataStore.GetDrawings(sessionId),
                    _sessionDataStore.GetTexts(sessionId),
                    _sessionDataStore.GetImages(sessionId)
                    );
            }
            await base.OnConnectedAsync();
        }

        public async Task<string> SendDrawingData(string sessionId, DrawingData drawingData)
        {
            if (string.IsNullOrEmpty(drawingData.Id))
            {
                drawingData.Id = Guid.NewGuid().ToString();  
            }
            _sessionDataStore.AddDrawing(sessionId, drawingData);

            await Clients.OthersInGroup(sessionId)
                .SendAsync("ReceiveDrawingData", drawingData);
            return drawingData.Id;
        }

        public async Task SendUndo(string sessionId, string id)
        {
            var item = _sessionDataStore.GetDrawingById(sessionId, id);
            if (item != null)
            {
                _sessionDataStore.RemoveDrawingById(sessionId, id);
                await Clients.OthersInGroup(sessionId).SendAsync("ReceiveUndo", id);
            }
        }

        public async Task SendRedo(string sessionId, DrawingData drawingData)
        {
            if (_sessionDataStore.GetDrawings(sessionId).Any(d => d.Id == drawingData.Id))
            {
                _sessionDataStore.AddDrawing(sessionId, drawingData);
                await Clients.OthersInGroup(sessionId).SendAsync("ReceiveRedo", drawingData);
            }
        }

        public async Task<string> SendTextData(string sessionId, TextData textData)
        {
            textData.Id = Guid.NewGuid().ToString();
            _sessionDataStore.AddText(sessionId, textData);

            await Clients.OthersInGroup(sessionId).SendAsync("ReceiveTextData", textData);
            return textData.Id;
        }

        public async Task MoveTextData(string sessionId, TextData textData)
        {
            _logger.LogInformation($"[MoveTex] Text: {textData.Text}, X: {textData.X}, Y: {textData.Y}");

            var text = _sessionDataStore.GetTextById(sessionId, textData.Id);
            if (text != null)
            {
                text.X = textData.X;
                text.Y = textData.Y;
                _sessionDataStore.UpdateText(sessionId, text);
                await Clients.OthersInGroup(sessionId).SendAsync("ReceiveTextMove", textData);
            }
        }

        public async Task DeleteTextData(string sessionId, TextData textData)
        {
            var text = _sessionDataStore.GetTextById(sessionId, textData.Id);
            if (text != null)
            {
                _sessionDataStore.RemoveTextById(sessionId, textData.Id);
                await Clients.OthersInGroup(sessionId).SendAsync("ReceiveTextDelete", textData.Id);
            }
        }

        public async Task UpdateTextData(string sessionId, TextData updatedText)
        {
            var text = _sessionDataStore.GetTextById(sessionId, updatedText.Id);
            if (text != null)
            {
                text.Text = updatedText.Text;
                text.FontSize = updatedText.FontSize;
                text.FontFamily = updatedText.FontFamily;
                text.Color = updatedText.Color;
                text.X = updatedText.X;
                text.Y = updatedText.Y;
                _sessionDataStore.UpdateText(sessionId, text);
                await Clients.OthersInGroup(sessionId).SendAsync("ReceiveTextUpdate", updatedText);
            }
        }

        public async Task<string> SendImageData(string sessionId, ImageData imageData)
        {            
            imageData.Id = Guid.NewGuid().ToString();
            _sessionDataStore.AddImage(sessionId, imageData);

            await Clients.OthersInGroup(sessionId).SendAsync("ReceiveImageData", imageData);
            return imageData.Id;
        }

        public async Task<bool> LockElement(string sessionId, string elementId, string userId)
        {
            if (_sessionDataStore.TryLockElement(sessionId, elementId, userId))
            {
                await Clients.OthersInGroup(sessionId).SendAsync("ElementLocked", elementId, userId);
                return true;
            }
            return false;
        }

        public async Task UnlockElement(string sessionId, string elementId, string userId)
        {
            if (_sessionDataStore.TryUnlockElement(elementId, userId))
            {
                await Clients.OthersInGroup(sessionId).SendAsync("ElementUnlocked", elementId);
            }
        }

        public async Task MoveImageData(string sessionId, ImageData imageData)
        {
            var image = _sessionDataStore.GetImageById(sessionId, imageData.Id);
            if (image != null)
            {
                image.X = imageData.X;
                image.Y = imageData.Y;
                _sessionDataStore.UpdateImage(sessionId, image);
                _logger.LogInformation($"[MoveImageData]: X: {imageData.X}, Y: {imageData.Y}");
                await Clients.OthersInGroup(sessionId).SendAsync("ReceiveImageMove", imageData);
            }
        }

        public async Task ResizeImageData(string sessionId, ImageData imageData)
        {
            var image = _sessionDataStore.GetImageById(sessionId, imageData.Id);
            if (image != null)
            {
                image.X = imageData.X;
                image.Y = imageData.Y;
                image.Width = imageData.Width;
                image.Height = imageData.Height;
                image.Rotation = imageData.Rotation;
                _sessionDataStore.UpdateImage(sessionId, image);
                await Clients.OthersInGroup(sessionId).SendAsync("ReceiveImageResize", imageData);
            }
        }

        public async Task DeleteImageData(string sessionId, ImageData imageData)
        {
            var image = _sessionDataStore.GetImageById(sessionId, imageData.Id);
            if (image != null)
            {
                _sessionDataStore.RemoveImageById(sessionId, imageData.Id);
                await Clients.OthersInGroup(sessionId).SendAsync("ReceiveImageDelete", imageData.Id);
            }
        }

        public async Task UpdateImageZIndex(string sessionId, ImageData imageData)
        {
            var image = _sessionDataStore.GetImageById(sessionId, imageData.Id);
            if (image != null)
            {
                image.ZIndex = imageData.ZIndex;
                _sessionDataStore.UpdateImage(sessionId, image);
                await Clients.OthersInGroup(sessionId).SendAsync("ReceiveImageZIndexUpdate", imageData);
            }
        }

        public async Task NotifyUserJoined(string sessionId, string username)
        {
            await Clients.Group(sessionId).SendAsync("UpdateUserList");
            await Clients.Group(sessionId).SendAsync("UserJoined", username);
        }

        public async Task NotifyUserLeft(string sessionId, string username)
        {
            await Clients.Group(sessionId).SendAsync("UpdateUserList");
            await Clients.Group(sessionId).SendAsync("UserLeft", username);
        }

        public async Task RemoveUserFromSession(string sessionId, string userId)
        {
            string connectionId = _sessionDataStore.RemoveUser(sessionId, userId);
            await Groups.RemoveFromGroupAsync(connectionId, sessionId);
            await Clients.Client(connectionId).SendAsync("ForceDisconnect");
        }

        public async Task JoinSession(string sessionId, string userId)
        {
            _sessionDataStore.AddUser(Context.ConnectionId, sessionId, userId);
            await Groups.AddToGroupAsync(Context.ConnectionId, sessionId);
        }

        public async Task LeaveSession(string sessionId, string userId)
        {
            _sessionDataStore.RemoveUser(sessionId, userId);
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, sessionId);
        }
        public async Task EndSession(string sessionId)
        {
            var connectionIds = _sessionDataStore.RemoveAllUsersFromSession(sessionId);
            foreach (var connectionId in connectionIds)
            {
                await Groups.RemoveFromGroupAsync(connectionId, sessionId);
                await Clients.Client(connectionId).SendAsync("ForceDisconnect"); 
            }
        }

        public async Task PingSession(string sessionId, string userId)
        {
            _sessionDataStore.UpdateLastSeen(sessionId, userId);

            var timeout = TimeSpan.FromSeconds(10);
            var now = DateTime.UtcNow;

            var expiredLocks = _sessionDataStore
                .GetAllLocks()
                .Where(lockEntry =>
                    now - lockEntry.LastActivityUtc > timeout &&
                    !_sessionDataStore.IsUserRecentlyActive(lockEntry.SessionId, lockEntry.UserId, timeout))
                .ToList();

            foreach (var lockInfo in expiredLocks)
            {
                if (_sessionDataStore.TryUnlockElement(lockInfo.ElementId, lockInfo.UserId))
                {
                    await Clients.Group(lockInfo.SessionId)
                        .SendAsync("ForceUnlockElement", lockInfo.ElementId, lockInfo.UserId);
                }
            }
        }
    }
}
