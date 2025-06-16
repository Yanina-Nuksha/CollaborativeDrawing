namespace CollaborativeDrawing.ServerApp.Models
{
    public class ElementLock
    {
        public string UserId { get; set; }
        public string SessionId { get; set; }
        public DateTime LastActivityUtc { get; set; }
    }
}
