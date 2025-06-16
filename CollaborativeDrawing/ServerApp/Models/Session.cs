namespace CollaborativeDrawing.ServerApp.Models
{
    public class Session
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public string Name { get; set; }
        public string? PasswordHash { get; set; }
        public string HostId { get; set; }
        public bool IsPrivate { get; set; }
        public bool IsActive { get; set; } = false;
        public DateTime? StartTime { get; set; }
        public DateTime? EndTime { get; set; }
        public List<TextData> Texts { get; set; } = new();
        public List<ImageData> Images { get; set; } = new();
        public List<DrawingData> Drawings { get; set; } = new();
        public List<ChatMessage> ChatMessages { get; set; } = new();
        public List<SessionUser> Users { get; set; } = new();
    }
}
