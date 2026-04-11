"""Run prisma/seed.ts and prisma/seed-admin.ts on the production server."""
import paramiko, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

HOST = '192.168.33.3'
USER = 'magday'
PASS = 'r15*gRJPulurILWV'
REMOTE_DIR = 'www/haccp.magday.ru/app'

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, port=22, username=USER, password=PASS, timeout=15)

commands = [
    (
        "Seed journal templates via Prisma CLI (loads .env automatically)",
        f'cd ~/{REMOTE_DIR} && source ~/.nvm/nvm.sh && npx prisma db seed 2>&1',
    ),
]

for label, cmd in commands:
    print(f"\n=== {label} ===")
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=300)
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    if out:
        print(out)
    if err:
        print('ERR:', err)

ssh.close()
print("\nSeeding complete.")
