using System.Text.Json.Serialization;

namespace CollaborativeDrawing.ServerApp.Models
{
    public class ChatMessage
    {
        public string Id { get; set; }
        public string SessionId { get; set; }
        [JsonIgnore]
        public Session Session { get; set; }
        public string SenderId { get; set; }
        public string SenderName { get; set; }
        public string Message { get; set; }
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    }
}