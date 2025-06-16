using CollaborativeDrawing.ServerApp.Models;
using Microsoft.EntityFrameworkCore;

namespace CollaborativeDrawing.ServerApp.Data.Repositories
{
    public class UserRepository
    {
        private readonly AppDbContext _context;

        public UserRepository(AppDbContext context)
        {
            _context = context;
        }

        public async Task<User?> GetUserByIdAsync(string id)
        {
            return await _context.Users.FirstOrDefaultAsync(u => u.Id == id);
        }

        public async Task<User?> GetUserByUsernameAsync(string username)
        {
            return await _context.Users.FirstOrDefaultAsync(u => u.Username == username);
        }

        public async Task<User> CreateUserAsync(string username, string passwordHash)
        {
            var user = new User
            {
                Id = Guid.NewGuid().ToString(),
                Username = username,
                PasswordHash = passwordHash,
                IsTemporary= false
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();
            return user;
        }
    }
}
