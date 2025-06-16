using CollaborativeDrawing.ServerApp.Models;
using Microsoft.EntityFrameworkCore;

namespace CollaborativeDrawing.ServerApp.Data.Repositories
{
    public class SessionRepository
    {
        private readonly AppDbContext _context;

        public SessionRepository(AppDbContext context)
        {
            _context = context;
        }

        public async Task<Session?> GetSessionByIdAsync(string sessionId)
        {
            return await _context.Sessions.FirstOrDefaultAsync(s => s.Id == sessionId);
        }

        public async Task CreateSessionAsync(Session session)
        {
            _context.Sessions.Add(session);
            await _context.SaveChangesAsync();
        }

        public async Task AddUserToSessionAsync(string sessionId, string userId)
        {
            var sessionUser = new SessionUser
            {
                SessionId = sessionId,
                UserId = userId
            };

            _context.SessionUsers.Add(sessionUser);
            await _context.SaveChangesAsync();
        }
    }
}
