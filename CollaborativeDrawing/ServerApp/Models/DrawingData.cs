using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace CollaborativeDrawing.ServerApp.Models
{
    public class DrawingData
    {
        public string Id { get; set; }
        public string SessionId { get; set; }
        [JsonIgnore]
        public Session? Session { get; set; }
        public string UserId { get; set; }
        public User? User { get; set; }
        public string Color { get; set; }
        public float Thickness { get; set; }
        public string ShapeType { get; set; }
        public float Opacity { get; set; }
        [NotMapped]
        public List<float> Points { get; set; } = new();
        public string PointsJson
        {
            get => JsonSerializer.Serialize(Points);
            set => Points = string.IsNullOrEmpty(value) ? new List<float>() : JsonSerializer.Deserialize<List<float>>(value);
        }
        public int ZIndex { get; set; }  
    }

}
