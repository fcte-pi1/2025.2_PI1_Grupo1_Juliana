import { test, expect } from '@playwright/test';

test.describe('Criação de Trajetória', () => {
  test('deve criar uma nova trajetória com sucesso', async ({ page }) => {
    // Navega para a página de criação de trajetória
    await page.goto('http://localhost:3000/create-trajectory');
    
    // Preenche o formulário
    await page.fill('input[name="name"]', 'Trajetória de Teste E2E');
    
    // Adiciona comandos
    await page.click('button[aria-label="Adicionar comando de movimento"]');
    await page.fill('input[name="commands.0.value"]', '100');
    
    // Envia o formulário
    await page.click('button[type="submit"]');
    
    // Verifica se foi redirecionado para a página de resultados
    await expect(page).toHaveURL(/.*\/results/);
    
    // Verifica se a trajetória aparece na lista
    const trajetoriaNome = await page.textContent('.trajectory-name');
    expect(trajetoriaNome).toContain('Trajetória de Teste E2E');
  });
});