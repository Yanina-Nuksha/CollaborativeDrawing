using CollaborativeDrawing.ServerApp.Data.Repositories;
using CollaborativeDrawing.ServerApp.Models;
using Microsoft.AspNetCore.Cryptography.KeyDerivation;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;

namespace CollaborativeDrawing.ServerApp.Services
{
    public class AuthService
    {
        private readonly UserRepository _userRepository;
        private readonly string _jwtSecret;

        public AuthService(UserRepository userRepository, IConfiguration config)
        {
            _userRepository = userRepository;
            _jwtSecret = config["Jwt:Secret"];
        }
        public async Task<string?> AuthenticateAsync(string username, string password)
        {
            var user = await _userRepository.GetUserByUsernameAsync(username);
            if (user == null || !VerifyPassword(password, user.PasswordHash))
                return null;

            return GenerateJwtToken(user);
        }

        public async Task<User?> RegisterUserAsync(string username, string password)
        {
            var existingUser = await _userRepository.GetUserByUsernameAsync(username);
            if (existingUser != null)
                return null;

            var hashedPassword = HashPassword(password);
            var user = await _userRepository.CreateUserAsync(username, hashedPassword);
            return user;
        }

        private string GenerateJwtToken(User user)
        {
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwtSecret));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
            var claims = new[]
            {
                new Claim(ClaimTypes.Name, user.Username),
                new Claim("userId", user.Id.ToString())
            };

            var token = new JwtSecurityToken(
                issuer: "CollaborativeDrawing",
                audience: "CollaborativeDrawingUsers",
                claims: claims,
                expires: DateTime.UtcNow.AddHours(2),
                signingCredentials: creds);

            return new JwtSecurityTokenHandler().WriteToken(token);
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

        private bool VerifyPassword(string password, string storedHash)
        {
            var parts = storedHash.Split('.');
            if (parts == null || parts.Length != 2) return false;

            byte[] salt = Convert.FromBase64String(parts[0]);
            string expectedHash = parts[1];

            string computedHash = Convert.ToBase64String(KeyDerivation.Pbkdf2(
                password: password,
                salt: salt,
                prf: KeyDerivationPrf.HMACSHA256,
                iterationCount: 100000,
                numBytesRequested: 32));

            return expectedHash == computedHash;
        }
    }
}