namespace CollaborativeDrawing.ServerApp.Models.Requests
{
    public class RemoveUserRequest
    {
        public string SessionId { get; set; }
        public string? UserId { get; set; }
        public string? HostId { get; set; }
    }
}
