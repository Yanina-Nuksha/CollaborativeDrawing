using Microsoft.EntityFrameworkCore;
using CollaborativeDrawing.ServerApp.Models;

namespace CollaborativeDrawing.ServerApp.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

        public DbSet<User> Users { get; set; }
        public DbSet<Session> Sessions { get; set; }
        public DbSet<ChatMessage> ChatMessages { get; set; }
        public DbSet<DrawingData> Drawings { get; set; }
        public DbSet<TextData> Texts { get; set; }
        public DbSet<ImageData> Images { get; set; }
        public DbSet<SessionUser> SessionUsers { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<SessionUser>()
               .HasOne(su => su.User)
               .WithMany(u => u.SessionUsers)
               .HasForeignKey(su => su.UserId);

            modelBuilder.Entity<SessionUser>()
                .HasOne(su => su.Session)
                .WithMany(s => s.Users)
                .HasForeignKey(su => su.SessionId);

            modelBuilder.Entity<TextData>()
                .HasOne(t => t.Session)
                .WithMany(s => s.Texts)
                .HasForeignKey(t => t.SessionId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<DrawingData>()
                .HasOne(d => d.Session)
                .WithMany(s => s.Drawings)
                .HasForeignKey(d => d.SessionId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<ImageData>()
                .HasOne(i => i.Session)
                .WithMany(s => s.Images)
                .HasForeignKey(i => i.SessionId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<ChatMessage>()
                .HasOne(cm => cm.Session)
                .WithMany(s => s.ChatMessages)
                .HasForeignKey(cm => cm.SessionId)
                .OnDelete(DeleteBehavior.Cascade);

        }
    }
}
