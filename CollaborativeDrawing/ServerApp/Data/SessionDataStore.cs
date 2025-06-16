using CollaborativeDrawing.ServerApp.Models;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Concurrent;

namespace CollaborativeDrawing.ServerApp.Data
{
    public class SessionDataStore
    {
        private readonly AppDbContext _context;

        private static readonly ConcurrentDictionary<string, Dictionary<string, string>> userSessionConnections = new();
        private static readonly ConcurrentDictionary<string, Dictionary<string, string>> userChatConnections = new();
        private static readonly ConcurrentDictionary<string, List<DrawingData>> sessionDrawings = new();
        private static readonly ConcurrentDictionary<string, List<TextData>> sessionTexts = new();
        private static readonly ConcurrentDictionary<string, List<ImageData>> sessionImages = new();
        private static readonly ConcurrentDictionary<string, List<ChatMessage>> sessionMessages = new();
        private static readonly ConcurrentDictionary<string, DateTime> userLastPing = new();
        private static readonly ConcurrentDictionary<string, ElementLock> elementLocks = new();

        public SessionDataStore(AppDbContext context)
        {
            _context = context;
        }

        public async Task LoadSessionData(string sessionId)
        {
            var session = await _context.Sessions
                .Include(s => s.Drawings)
                .Include(s => s.Texts)
                .Include(s => s.Images)
                .Include(s => s.ChatMessages)
                .FirstOrDefaultAsync(s => s.Id == sessionId);

            if (session == null)
            {
                throw new InvalidOperationException("Сессия не найдена.");
            }

            sessionDrawings[sessionId] = session.Drawings.ToList();
            sessionTexts[sessionId] = session.Texts.ToList();
            sessionImages[sessionId] = session.Images.ToList();
        }
        public async Task LoadChatData(string sessionId)
        {
            var session = await _context.Sessions
                .Include(s => s.ChatMessages)
                .FirstOrDefaultAsync(s => s.Id == sessionId);
            if (session == null)
            {
                throw new InvalidOperationException("Сессия не найдена.");
            }
            sessionMessages[sessionId] = session.ChatMessages.ToList();
        }

        public bool DoesSessionExist(string sessionId)
        {
            if (sessionDrawings.ContainsKey(sessionId))
            {
                return true;
            }
            if (sessionTexts.ContainsKey(sessionId))
            {
                return true;
            }
            if (sessionImages.ContainsKey(sessionId))
            {
                return true;
            }
            if (sessionMessages.ContainsKey(sessionId))
            {
                return true;
            }
            return false;
        }
        public bool DoesChatExist(string sessionId)
        {
            if (sessionMessages.ContainsKey(sessionId))
            {
                return true;
            }
            return false;
        }

        public List<string> GetUsers(string sessionId) 
        {
            return userSessionConnections
                .Where(kv => kv.Value.ContainsKey(sessionId))
                .Select(kv => kv.Key)
                .ToList();
        }

        public List<DrawingData> GetDrawings(string sessionId)
        {
            sessionDrawings.TryGetValue(sessionId, out var drawings);
            return drawings ?? new List<DrawingData>();
        }

        public List<TextData> GetTexts(string sessionId)
        {
            sessionTexts.TryGetValue(sessionId, out var texts);
            return texts ?? new List<TextData>();
        }

        public List<ImageData> GetImages(string sessionId)
        {
            sessionImages.TryGetValue(sessionId, out var images);
            return images ?? new List<ImageData>();
        }

        public List<ChatMessage> GetMessages(string sessionId)
        {
            sessionMessages.TryGetValue(sessionId, out var messages);
            return messages ?? new List<ChatMessage>();
        }

        public string? GetConnectionChatId(string sessionId, string userId)
        {
            if (userChatConnections.TryGetValue(userId, out var sessions) && sessions.TryGetValue(sessionId, out var connectionId))
            {
                return connectionId; 
            }
            return null;
        }

        public DrawingData GetDrawingById(string sessionId, string drawingId)
        {
            var drawings = GetDrawings(sessionId);
            return drawings.FirstOrDefault(d => d.Id == drawingId);
        }

        public TextData GetTextById(string sessionId, string textId)
        {
            var texts = GetTexts(sessionId);
            return texts.FirstOrDefault(t => t.Id == textId);
        }

        public ImageData GetImageById(string sessionId, string imageId)
        {
            var images = GetImages(sessionId);
            return images.FirstOrDefault(i => i.Id == imageId);
        }
        public ChatMessage GetMessageById(string sessionId, string messageId)
        {
            var messages = GetMessages(sessionId);
            return messages.FirstOrDefault(i => i.Id == messageId);
        }

        public string RemoveUser(string sessionId, string userId)
        {
            if (userSessionConnections.TryGetValue(userId, out var sessionConnections)
         && sessionConnections.TryGetValue(sessionId, out var connectionId))
            {
                sessionConnections.Remove(sessionId);
                if (sessionConnections.Count == 0)
                {
                    userSessionConnections.TryRemove(userId, out _);
                }
                return connectionId;
            }
            return null;
        }

        public string RemoveChatUser(string sessionId, string userId)
        {
            if (userChatConnections.TryGetValue(userId, out var sessionConnections)
         && sessionConnections.TryGetValue(sessionId, out var connectionId))
            {
                sessionConnections.Remove(sessionId);
                if (sessionConnections.Count == 0)
                {
                    userChatConnections.TryRemove(userId, out _);
                }
                return connectionId;
            }
            return null;
        }

        public bool RemoveDrawingById(string sessionId, string drawingId)
        {
            if (sessionDrawings.ContainsKey(sessionId))
            {
                var drawing = sessionDrawings[sessionId].FirstOrDefault(d => d.Id == drawingId);
                if (drawing != null)
                {
                    sessionDrawings[sessionId].Remove(drawing);
                    return true;
                }
            }
            return false;
        }
        public bool RemoveTextById(string sessionId, string textId)
        {
            if (sessionTexts.ContainsKey(sessionId))
            {
                var text = sessionTexts[sessionId].FirstOrDefault(t => t.Id == textId);
                if (text != null)
                {
                    sessionTexts[sessionId].Remove(text);
                    return true;
                }
            }
            return false;
        }

        public bool RemoveImageById(string sessionId, string imageId)
        {
            if (sessionImages.ContainsKey(sessionId))
            {
                var image = sessionImages[sessionId].FirstOrDefault(i => i.Id == imageId);
                if (image != null)
                {
                    sessionImages[sessionId].Remove(image);
                    return true;
                }
            }
            return false;
        }

        public bool RemoveMessageById(string sessionId, string messageId)
        {
            if (sessionMessages.ContainsKey(sessionId))
            {
                var message = sessionMessages[sessionId].FirstOrDefault(i => i.Id == messageId);
                if (message != null)
                {
                    sessionMessages[sessionId].Remove(message);
                    return true;
                }
            }
            return false;
        }

        public bool UpdateDrawing(string sessionId, DrawingData updatedDrawing)
        {
            if (sessionDrawings.ContainsKey(sessionId))
            {
                var existingDrawing = sessionDrawings[sessionId].FirstOrDefault(d => d.Id == updatedDrawing.Id);
                if (existingDrawing != null)
                {
                    existingDrawing = updatedDrawing;
                    return true;
                }
            }
            return false;
        }

        public bool UpdateText(string sessionId, TextData updatedText)
        {
            if (sessionTexts.ContainsKey(sessionId))
            {
                var existingText = sessionTexts[sessionId].FirstOrDefault(t => t.Id == updatedText.Id);
                if (existingText != null)
                {
                    existingText = updatedText;
                    return true;
                }
            }
            return false;
        }

        public bool UpdateImage(string sessionId, ImageData updatedImage)
        {
            if (sessionImages.ContainsKey(sessionId))
            {
                var existingImage = sessionImages[sessionId].FirstOrDefault(i => i.Id == updatedImage.Id);
                if (existingImage != null)
                {
                    existingImage = updatedImage;
                    return true;
                }
            }
            return false;
        }

        public bool UpdateMessage(string sessionId, ChatMessage updatedMessage)
        {
            if (sessionMessages.ContainsKey(sessionId))
            {
                var existingMessage = sessionMessages[sessionId].FirstOrDefault(i => i.Id == updatedMessage.Id);
                if (existingMessage != null)
                {
                    existingMessage = updatedMessage;
                    return true;
                }
            }
            return false;
        }

        public void AddChatUser(string connectionId, string sessionId, string userId)
        {
            if (!userChatConnections.ContainsKey(userId))
            {
                userChatConnections[userId] = new Dictionary<string, string>();
            }
            userChatConnections[userId][sessionId] = connectionId;
        }

        public void AddUser(string connectionId, string sessionId, string userId)
        {
            if (!userSessionConnections.ContainsKey(userId))
            {
                userSessionConnections[userId] = new Dictionary<string, string>();
            }
            userSessionConnections[userId][sessionId] = connectionId; 
        }

        public void AddDrawing(string sessionId, DrawingData drawing)
        {
            if (!sessionDrawings.ContainsKey(sessionId))
            {
                sessionDrawings[sessionId] = new List<DrawingData>();
            }
            sessionDrawings[sessionId].Add(drawing);
        }

        public void AddText(string sessionId, TextData text)
        {
            if (!sessionTexts.ContainsKey(sessionId))
            {
                sessionTexts[sessionId] = new List<TextData>();
            }
            sessionTexts[sessionId].Add(text);
        }

        public void AddImage(string sessionId, ImageData image)
        {
            if (!sessionImages.ContainsKey(sessionId))
            {
                sessionImages[sessionId] = new List<ImageData>();
            }
            sessionImages[sessionId].Add(image);
        }

        public void AddMessage(string sessionId, ChatMessage message)
        {
            if (!sessionMessages.ContainsKey(sessionId))
            {
                sessionMessages[sessionId] = new List<ChatMessage>();
            }
            sessionMessages[sessionId].Add(message);
        }

        public List<string> RemoveAllUsersFromSession(string sessionId)
        {
            List<string> removedConnections = new List<string>();
            foreach (var userId in userSessionConnections.Keys.ToList()) 
            {
                if (userSessionConnections.TryGetValue(userId, out var sessionConnections)
                    && sessionConnections.ContainsKey(sessionId))
                {
                    if (sessionConnections.Remove(sessionId, out var connectionId))
                    {
                        removedConnections.Add(connectionId); 
                    }
                    if (sessionConnections.Count == 0)
                    {
                        userSessionConnections.TryRemove(userId, out _);
                    }
                }
            }
            return removedConnections;
        }
        public List<string> RemoveAllChatUsersFromSession(string sessionId)
        {
            List<string> removedConnections = new List<string>();
            foreach (var userId in userChatConnections.Keys.ToList())
            {
                if (userChatConnections.TryGetValue(userId, out var chatConnections)
                    && chatConnections.ContainsKey(sessionId))
                {
                    if (chatConnections.Remove(sessionId, out var connectionId))
                    {
                        removedConnections.Add(connectionId);
                    }
                    if (chatConnections.Count == 0)
                    {
                        userChatConnections.TryRemove(userId, out _);
                    }
                }
            }
            return removedConnections;
        }

        public void ClearSessionData(string sessionId)
        {
            sessionDrawings.TryRemove(sessionId, out _);
            sessionTexts.TryRemove(sessionId, out _);
            sessionImages.TryRemove(sessionId, out _);
            sessionMessages.TryRemove(sessionId, out _);
        }

        public bool TryLockElement(string sessionId, string elementId, string userId)
        {
            return elementLocks.TryAdd(elementId, new ElementLock
            {
                SessionId = sessionId,
                UserId = userId,
                LastActivityUtc = DateTime.UtcNow
            });
        }

        public bool TryUnlockElement(string elementId, string userId)
        {
            if (elementLocks.TryGetValue(elementId, out var elementLock) && elementLock.UserId == userId)
            {
                return elementLocks.TryRemove(elementId, out _);
            }
            return false;
        }

        public List<(string ElementId, string SessionId, string UserId, DateTime LastActivityUtc)> GetAllLocks()
        {
            return elementLocks
                .Select(kvp => (
                    ElementId: kvp.Key,
                    SessionId: kvp.Value.SessionId,
                    UserId: kvp.Value.UserId,
                    LastActivityUtc: kvp.Value.LastActivityUtc
                ))
                .ToList();
        }

        public void UpdateLastSeen(string sessionId, string userId)
        {
            string key = $"{sessionId}:{userId}";
            userLastPing[key] = DateTime.UtcNow;
        }

        public bool IsUserRecentlyActive(string sessionId, string userId, TimeSpan threshold)
        {
            string key = $"{sessionId}:{userId}";
            return userLastPing.TryGetValue(key, out var lastPing) && DateTime.UtcNow - lastPing < threshold;
        }
    }
}
