NEON DUEL ENERGY TAG — COMO TESTAR O 1V1

1. Instale o Node.js no computador.
2. Abra o terminal dentro desta pasta.
3. Rode: npm install
4. Depois: npm start
5. Abra no navegador: http://localhost:8080

PARA TESTAR EM 2 DISPOSITIVOS NA MESMA REDE:
- Descubra o IP local do computador, por exemplo 192.168.0.10.
- Nos dois aparelhos abra http://192.168.0.10:8080
- Um jogador cria a sala e envia o código ao outro.

PARA PUBLICAR NA INTERNET:
- Hospede esta pasta em um serviço que execute Node.js e aceite WebSocket.
- O servidor precisa iniciar com: npm start
- A variável PORT é lida automaticamente pelo server.js.
- Ao abrir o jogo pelo mesmo domínio, o endereço WebSocket é preenchido automaticamente.

CONTROLES
PC: WASD, mouse, clique, R, teclas 1/2/3.
Celular: analógico esquerdo, arrastar do lado direito, DISPARAR, RECARGA e TROCAR.

O protótipo usa emissores de energy-tag fictícios e efeitos sem sangue.
