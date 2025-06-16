using System.Text.Json.Serialization;

namespace CollaborativeDrawing.ServerApp.Models
{
    public class TextData 
    {
        public string Id { get; set; }
        public string SessionId { get; set; }
        [JsonIgnore]
        public Session Session { get; set; }
        public string UserId { get; set; }
        public User User { get; set; }
        public float X { get; set; }
        public float Y { get; set; }
        public string Text { get; set; }
        public string Color { get; set; }
        public int FontSize { get; set; } = 20;  
        public string FontFamily { get; set; } = "Arial";
        public int ZIndex { get; set; }
    }
}
