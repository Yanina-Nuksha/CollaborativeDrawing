using Microsoft.AspNetCore.Cryptography.KeyDerivation;
using Microsoft.AspNetCore.Mvc;
using System.Security.Cryptography;
using CollaborativeDrawing.ServerApp.Models;
using CollaborativeDrawing.ServerApp.Data;
using Microsoft.AspNetCore.Authorization;
using CollaborativeDrawing.ServerApp.Models.Requests;
using Microsoft.EntityFrameworkCore;
using QRCoder;
using System.Net.Sockets;
using System.Net;

namespace CollaborativeDrawing.ServerApp.Controllers
{
    [ApiController]
    [Route("session")]
    public class SessionController : ControllerBase
    {
        private readonly IWebHostEnvironment _env;
        private readonly AppDbContext _context;
        private readonly ILogger<SessionController> _logger;
        private readonly SessionDataStore _sessionDataStore;
        private readonly IConfiguration _config;

        public SessionController(AppDbContext context, SessionDataStore sessionDataStore, IWebHostEnvironment env, ILogger<SessionController> logger, IConfiguration config)
        {
            _env = env;
            _context = context;
            _logger = logger;
            _sessionDataStore = sessionDataStore;
            _config = config;   
        }

        [HttpGet("list")]
        public IActionResult GetSessions()
        {
            var sessions = _context.Sessions
               .Select(s => new { s.Id, s.Name, s.IsPrivate, s.HostId, s.IsActive })
               .ToList();

            return Ok(sessions);
        }

        [Authorize(Policy = "Optional")]
        [HttpPost("join")]
        public IActionResult JoinSession([FromBody] JoinSessionRequest request)
        {
            var userId = User.FindFirst("userId")?.Value;
            var session = _context.Sessions.FirstOrDefault(s => s.Id == request.SessionId);

            if (session == null)
                return NotFound(new { error = "Сеанс не найден" });

            if (session.IsPrivate && !VerifyPassword(request.Password, session.PasswordHash))
                return Unauthorized(new { error = "Неверный пароль" });

            User user = null;
            if (userId != null)
            {
                user = _context.Users.FirstOrDefault(u => u.Id == userId);
                if (!_context.SessionUsers.Any(su => su.SessionId == session.Id && su.UserId == user.Id))
                {
                    _context.SessionUsers.Add(new SessionUser { SessionId = session.Id, UserId = user.Id });
                    _context.SaveChanges();
                }
                return Ok(new { userId = user.Id, username = user.Username, isTemporary = false });
            }

            if (!string.IsNullOrEmpty(request.TempUserId))
            {
                user = _context.Users
                    .Include(u => u.SessionUsers)
                    .FirstOrDefault(u => u.Id == request.TempUserId && u.IsTemporary);

                if (user != null)
                {
                    if (!_context.SessionUsers.Any(su => su.SessionId == session.Id && su.UserId == user.Id))
                    {
                        _context.SessionUsers.Add(new SessionUser { SessionId = session.Id, UserId = user.Id });
                        _context.SaveChanges();
                    }
                    return Ok(new { userId = user.Id, username = user.Username, isTemporary = true });
                }
            }

            string username = request.Username;
            if (string.IsNullOrWhiteSpace(username))
                return BadRequest(new { error = "Имя не может быть пустым" });
            if (_context.SessionUsers.Any(su => su.SessionId == session.Id && su.User.Username == username))
            {
                username += " (guest)";
            }
            user = new User { Username = username, IsTemporary = true };
            _context.Users.Add(user);
            _context.SaveChanges();
            _context.SessionUsers.Add(new SessionUser { SessionId = session.Id, UserId = user.Id });
            _context.SaveChanges();
            return Ok(new { userId = user.Id, username = user.Username, isTemporary = true });
        }

        [Authorize]
        [HttpGet("user-list")]
        public IActionResult GetUserSessions()
        {
            var userId = User.FindFirst("userId")?.Value;
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized("Не удалось определить пользователя");
            }
            var sessions = _context.Sessions
                .Where(s => s.HostId == userId)
                .Select(s => new { s.Id, s.Name, s.IsPrivate, s.IsActive })
                .ToList();

            return Ok(sessions);
        }

        [Authorize]
        [HttpPost("create")]
        public IActionResult CreateSession([FromBody] CreateSessionRequest request)
        {
            if (string.IsNullOrEmpty(request.SessionName))
                return BadRequest("Название сеанса не может быть пустым");

            bool nameExists = _context.Sessions.Any(s => s.Name == request.SessionName);
            if (nameExists)
                return BadRequest(new { error = "Сеанс с таким названием уже существует" });

            var userId = User.FindFirst("userId")?.Value;
            var session = new Session
            {
                Name = request.SessionName,
                IsPrivate = request.IsPrivate,
                HostId = userId,
                PasswordHash = request.IsPrivate && !string.IsNullOrEmpty(request.Password)
                              ? HashPassword(request.Password) : null
            };

            _context.Sessions.Add(session);
            _context.SaveChanges();


            return Ok(new
            {
                sessionId = session.Id,
            });
        }


        [Authorize]
        [HttpPost("start")]
        public IActionResult StartSession(string sessionId)
        {
            var session = _context.Sessions.FirstOrDefault(s => s.Id == sessionId);
            if (session == null) return Unauthorized("Нет доступа");

            session.IsActive = true;
            session.StartTime = DateTime.UtcNow;
            _context.SaveChanges();
            return Ok(new { message = "Сеанс начат" });
        }

        [HttpGet("session-info")]
        public IActionResult GetSessionInfo(string sessionId)
        {
            var session = _context.Sessions
                .FirstOrDefault(s => s.Id == sessionId);

            if (session == null) return NotFound("Сессия не найдена");

            return Ok(new { session.Id, session.HostId, session.IsActive, session.IsPrivate });
        }

        [Authorize]
        [HttpPost("end")]
        public IActionResult EndSession(string sessionId)
        {
            var session = _context.Sessions
            .Include(s => s.ChatMessages)
            .Include(s => s.Texts)
            .Include(s => s.Images)
            .Include(s => s.Drawings)
            .Include(s => s.ChatMessages)
            .FirstOrDefault(s => s.Id == sessionId);
            if (session == null) return Unauthorized("Сессия не найдена");

            var drawings = _sessionDataStore.GetDrawings(sessionId);
            var texts = _sessionDataStore.GetTexts(sessionId);
            var images = _sessionDataStore.GetImages(sessionId);
            var messages = _sessionDataStore.GetMessages(sessionId);

            foreach (var drawing in drawings)
            {
                var existing = _context.Drawings.Local.FirstOrDefault(d => d.Id == drawing.Id);
                if (existing == null)
                    _context.Drawings.Add(drawing);
                else
                    _context.Entry(existing).CurrentValues.SetValues(drawing);
            }
            foreach (var text in texts)
            {
                var existing = _context.Texts.Local.FirstOrDefault(t => t.Id == text.Id);
                if (existing == null)
                    _context.Texts.Add(text);
                else
                    _context.Entry(existing).CurrentValues.SetValues(text);
            }
            foreach (var image in images)
            {
                var existing = _context.Images.Local.FirstOrDefault(i => i.Id == image.Id);
                if (existing == null)
                    _context.Images.Add(image);
                else
                    _context.Entry(existing).CurrentValues.SetValues(image);
            }
            foreach (var message in messages)
            {
                var existing = _context.ChatMessages.Local.FirstOrDefault(i => i.Id == message.Id);
                if (existing == null)
                    _context.ChatMessages.Add(message);
                else
                    _context.Entry(existing).CurrentValues.SetValues(message);
            }

            session.IsActive = false;
            session.EndTime = DateTime.UtcNow;
            _context.SaveChanges();
            _sessionDataStore.ClearSessionData(sessionId);

            return Ok(new { message = "Сеанс завершен" });
        }

        [Authorize]
        [HttpPost("delete")]
        public IActionResult DeleteSession(string sessionId)
        {
            var session = _context.Sessions.FirstOrDefault(s => s.Id == sessionId);
            if (session == null) return NotFound("Сеанс не найден");

            _context.Sessions.Remove(session);
            _context.SaveChanges();
            return Ok(new { message = "Сеанс удалён" });
        }

        [Authorize]
        [HttpPost("update")]
        public IActionResult UpdateSession([FromBody] UpdateSessionRequest request)
        {
            var session = _context.Sessions.FirstOrDefault(s => s.Id == request.SessionId);
            if (session == null) return NotFound("Сеанс не найден!");

            bool nameExists = _context.Sessions.Any(s => s.Name == request.SessionName && s.Id != request.SessionId);
            if (nameExists)
            {
                return BadRequest(new { error = "Сеанс с таким названием уже существует" });
            }

            session.Name = request.SessionName;
            session.IsPrivate = request.IsPrivate;

            if (!string.IsNullOrEmpty(request.Password))
            {
                session.PasswordHash = HashPassword(request.Password);
            }

            _context.SaveChanges();
            return Ok(new { message = "Сеанс обновлён" });
        }

        [HttpPost("removeUser")]
        public IActionResult RemoveUser([FromBody] RemoveUserRequest request)
        {
            var session = _context.Sessions.FirstOrDefault(s => s.Id == request.SessionId);
            if (session == null) return Unauthorized("Сеанс не найден");

            if (session.HostId != request.HostId)
                return Unauthorized("Нет доступа. Только хост может удалять пользователей.");

            if (session.HostId == request.UserId)
                return BadRequest("Хост не может удалить самого себя.");

            var sessionUser = _context.SessionUsers.FirstOrDefault(su => su.SessionId == session.Id && su.UserId == request.UserId);

            if (sessionUser != null)
            {
                return Ok(new { message = "Пользователь удалён" });
            }
            return NotFound("Пользователь не найден в сессии.");
        }

        [HttpGet("users")]
        public IActionResult GetSessionUsers(string sessionId)
        {
            var session = _context.Sessions.FirstOrDefault(s => s.Id == sessionId);
            if (session == null) return NotFound(new { message = "Сеанс не найден" });

            var allUsersInSession = _context.SessionUsers
                .Where(su => su.SessionId == session.Id)
                .Select(su => new
                {
                    id = su.UserId,
                    username = su.User.Username,
                    temporary = su.User.IsTemporary
                })
                .ToList();

            var activeUserIds = _sessionDataStore.GetUsers(sessionId);
            var result = allUsersInSession
                .Where(u => activeUserIds.Contains(u.id) || _sessionDataStore.IsUserRecentlyActive(sessionId, u.id, TimeSpan.FromSeconds(30)))
                .Select(u => new {
                    u.id,
                    u.username,
                    u.temporary,
                    status = activeUserIds.Contains(u.id)
                        ? (_sessionDataStore.IsUserRecentlyActive(sessionId, u.id, TimeSpan.FromSeconds(30)) ? "active" : "inactive")
                        : "inactive"
                });

            return Ok(result);
        }

        private string HashPassword(string password)
        {
            byte[] salt = new byte[16];
            using (var rng = RandomNumberGenerator.Create())
            {
                rng.GetBytes(salt);
            }

            string hashed = Convert.ToBase64String(KeyDerivation.Pbkdf2(
                password: password,
                salt: salt,
                prf: KeyDerivationPrf.HMACSHA256,
                iterationCount: 100000,
                numBytesRequested: 32));

            return $"{Convert.ToBase64String(salt)}.{hashed}";
        }
        private bool VerifyPassword(string password, string hashedPassword)
        {
            string[] parts = hashedPassword.Split('.');
            byte[] salt = Convert.FromBase64String(parts[0]);
            string storedHash = parts[1];

            string computedHash = Convert.ToBase64String(KeyDerivation.Pbkdf2(
                password: password,
                salt: salt,
                prf: KeyDerivationPrf.HMACSHA256,
                iterationCount: 100000,
                numBytesRequested: 32));

            return storedHash == computedHash;
        }

        [HttpPost("upload-image")]
        public async Task<IActionResult> UploadImage(IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest("Empty file");

            var uploadsDir = Path.Combine(_env.WebRootPath, "uploads");
            Directory.CreateDirectory(uploadsDir);
            var fileName = Guid.NewGuid() + Path.GetExtension(file.FileName);
            var filePath = Path.Combine(uploadsDir, fileName);

            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }
            return Ok(new { url = $"/uploads/{fileName}" });
        }

        [Authorize]
        [HttpGet("get-qr")]
        public IActionResult GetQrCode([FromQuery] string sessionId)
        {
            var session = _context.Sessions.FirstOrDefault(s => s.Id == sessionId);
            if (session == null) return NotFound("Сеанс не найден");
            string ip = _config["ServerSettings:LocalIpAddress"];
            string port = _config["ServerSettings:Port"];
            string sessionUrl = $"http://{ip}:{port}/pages/qr-join.html?sessionId={sessionId}";
            
            using var qrGenerator = new QRCodeGenerator();
            using var qrCodeData = qrGenerator.CreateQrCode(sessionUrl, QRCodeGenerator.ECCLevel.Q);
            using var qrCode = new PngByteQRCode(qrCodeData);
            
            var qrCodeImage = qrCode.GetGraphic(20);
            string base64Qr = Convert.ToBase64String(qrCodeImage);
            string qrDataUrl = $"data:image/png;base64,{base64Qr}";

            return Ok(new { qrCode = qrDataUrl });
        }

    }
}

