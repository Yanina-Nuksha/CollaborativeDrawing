namespace CollaborativeDrawing.ServerApp.Models
{
    public class SessionUser
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public string SessionId { get; set; }
        public Session Session { get; set; }
        public string UserId { get; set; }
        public User User { get; set; }
    }
}
