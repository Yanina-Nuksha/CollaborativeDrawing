namespace CollaborativeDrawing.ServerApp.Models
{
    public class User
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public string Username { get; set; }
        public string? PasswordHash { get; set; }
        public bool IsTemporary { get; set; } = false;  
        public List<SessionUser> SessionUsers { get; set; } = new List<SessionUser>();
    }
}
