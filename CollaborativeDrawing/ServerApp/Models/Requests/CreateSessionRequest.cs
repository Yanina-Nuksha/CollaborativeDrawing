namespace CollaborativeDrawing.ServerApp.Models.Requests
{
    public class CreateSessionRequest
    {
        public string SessionName { get; set; }
        public bool IsPrivate { get; set; }
        public string? Password { get; set; }
    }
}
