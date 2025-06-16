using CollaborativeDrawing.ServerApp.Models.Requests;
using CollaborativeDrawing.ServerApp.Services;
using Microsoft.AspNetCore.Mvc;

namespace CollaborativeDrawing.ServerApp.Controllers
{
    [Route("auth")]
    [ApiController]
    public class AuthController : ControllerBase
    {
        private readonly AuthService _authService;

        public AuthController(AuthService authService)
        {
            _authService = authService;
        }

        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterRequest request)
        {
            var user = await _authService.RegisterUserAsync(request.Username, request.Password);
            if (user == null)
                return BadRequest(new { error = "Пользователь уже существует" });

            return Ok(new { userId = user.Id, username = user.Username });
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequest request)
        {
            var token = await _authService.AuthenticateAsync(request.Username, request.Password);
            if (token == null)
                return Unauthorized(new { error = "Неверный логин или пароль" });

            return Ok(new { token });
        }
    }
}
