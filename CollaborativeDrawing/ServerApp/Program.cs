using CollaborativeDrawing.ServerApp.Data;
using CollaborativeDrawing.ServerApp.Data.Repositories;
using CollaborativeDrawing.ServerApp.Hubs;
using CollaborativeDrawing.ServerApp.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using System.Text;

var builder = WebApplication.CreateBuilder(args);
var key = Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Secret"]);

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.RequireHttpsMetadata = false;
        options.SaveToken = true;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(key),
            ValidateIssuer = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidateAudience = true,
            ValidAudience = builder.Configuration["Jwt:Audience"]
        };
    });

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("Optional", policy =>
    {
        policy.RequireAssertion(context => true); 
    });
});

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseMySql(connectionString, ServerVersion.AutoDetect(connectionString)));

builder.Services.AddScoped<UserRepository>();
builder.Services.AddScoped<SessionRepository>();
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<SessionDataStore>();
builder.Services.AddControllersWithViews();
builder.Services.AddSignalR(options => {
    options.MaximumReceiveMessageSize = 32 * 1024;
});


builder.WebHost.ConfigureKestrel(serverOptions =>
{
    serverOptions.ListenAnyIP(5116); 
    serverOptions.ListenAnyIP(7172, listenOptions =>
    {
        listenOptions.UseHttps(); 
    });
});

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.WithOrigins("http://127.0.0.1:8080", "http://localhost:8080", "http://192.168.1.103:8080")
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials());
});

var app = builder.Build();

app.UseStaticFiles();
app.UseCors();
app.UseRouting();
app.UseAuthentication();
app.UseAuthorization();
app.UseEndpoints(routes =>
{
    routes.MapHub<DrawingHub>("/drawingHub");
    routes.MapHub<ChatHub>("/chatHub");
    routes.MapControllers();
});

app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(
        Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads")),
    RequestPath = "/uploads"
});

app.Run();
