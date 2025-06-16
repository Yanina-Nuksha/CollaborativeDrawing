namespace CollaborativeDrawing.ServerApp.Models.Requests
{
    public class UpdateSessionRequest
    {
        public string SessionId { get; set; }
        public string SessionName { get; set; }
        public bool IsPrivate { get; set; }
        public string? Password { get; set; }
    }
}
