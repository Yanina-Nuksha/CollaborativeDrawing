namespace CollaborativeDrawing.ServerApp.Models.Requests
{
    public class JoinSessionRequest
    {
        public string SessionId { get; set; }
        public string? Username { get; set; }
        public string? Password { get; set; }
        public string? TempUserId { get; set; } 
    }
}
