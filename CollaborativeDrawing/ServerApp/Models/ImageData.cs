using System.Text.Json.Serialization;

namespace CollaborativeDrawing.ServerApp.Models
{
    public class ImageData
    {
        public string Id { get; set; }
        public string SessionId { get; set; }
        [JsonIgnore]
        public Session Session { get; set; }
        public string UserId { get; set; }
        public User User { get; set; }
        public string Url { get; set; } 
        public float X { get; set; }
        public float Y { get; set; }
        public float Width { get; set; }
        public float Height { get; set; }
        public float Rotation { get; set; }
        public int ZIndex { get; set; }
    }
}
