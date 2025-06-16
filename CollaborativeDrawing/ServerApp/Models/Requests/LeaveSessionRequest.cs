namespace CollaborativeDrawing.ServerApp.Models.Requests
{
    public class LeaveSessionRequest
    {
        public string SessionId { get; set; }
        public string? UserId { get; set; }
    }
}
