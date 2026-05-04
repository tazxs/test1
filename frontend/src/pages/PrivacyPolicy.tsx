import { Link } from 'react-router-dom'
import { ROUTES } from '@lib/constants'

/**
 * Privacy Policy page for NalogAI.
 * Compliant with the Law of the Republic of Kazakhstan
 * "On Personal Data and their Protection" (No. 94-V dated 21 May 2013).
 *
 * Key compliance points:
 * - Data stored on servers in Kazakhstan (or as required by local law)
 * - Explicit consent required before data collection
 * - User rights: access, correction, deletion of personal data
 * - Data retention: 5 years for tax records per RK Tax Code
 */
export function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-navy">
      <div className="max-w-[800px] mx-auto px-5 py-12 md:py-20">
        {/* Back link */}
        <Link
          to={ROUTES.HOME}
          className="inline-flex items-center gap-2 font-body text-[14px] text-white-dim hover:text-white transition-colors duration-150 mb-8"
        >
          ← Вернуться на главную
        </Link>

        <h1 className="font-display text-[32px] md:text-[40px] text-white mb-2">
          Политика конфиденциальности
        </h1>
        <p className="font-body text-[14px] text-white-dim mb-10">
          Последнее обновление: 1 мая 2026 г.
        </p>

        <div className="space-y-8 font-body text-[15px] text-white-dim leading-relaxed">
          <section>
            <h2 className="font-display text-[20px] text-white mb-3">1. Общие положения</h2>
            <p>
              Настоящая Политика конфиденциальности (далее — «Политика») описывает, как ТОО «NalogAI»
              (далее — «Компания», «мы») собирает, использует, хранит и защищает ваши персональные
              данные при использовании сервиса NalogAI (далее — «Сервис»).
            </p>
            <p className="mt-3">
              Политика разработана в соответствии с Законом Республики Казахстан от 21 мая 2013 года
              № 94-V «О персональных данных и их защите» (далее — «Закон о персональных данных»).
            </p>
          </section>

          <section>
            <h2 className="font-display text-[20px] text-white mb-3">2. Какие данные мы собираем</h2>
            <p>При использовании Сервиса мы собираем следующие категории персональных данных:</p>

            <h3 className="font-body font-semibold text-white mt-4 mb-2">2.1. Данные, предоставляемые при регистрации:</h3>
            <ul className="list-disc list-inside space-y-1">
              <li>ФИО</li>
              <li>Адрес электронной почты</li>
              <li>ИИН (индивидуальный идентификационный номер)</li>
              <li>Пароль (хранится в зашифрованном виде)</li>
            </ul>

            <h3 className="font-body font-semibold text-white mt-4 mb-2">2.2. Данные о деятельности:</h3>
            <ul className="list-disc list-inside space-y-1">
              <li>Тип деятельности (самозанятый, ИП, ТОО)</li>
              <li>Налоговый режим</li>
              <li>Финансовые транзакции (доходы и расходы)</li>
              <li>Данные банковских выписок (при подключении банков)</li>
            </ul>

            <h3 className="font-body font-semibold text-white mt-4 mb-2">2.3. Технические данные:</h3>
            <ul className="list-disc list-inside space-y-1">
              <li>IP-адрес</li>
              <li>Данные браузера и устройства</li>
              <li>Файлы cookie и аналогичные технологии</li>
              <li>Логи использования Сервиса</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-[20px] text-white mb-3">3. Цели обработки персональных данных</h2>
            <p>Мы обрабатываем ваши персональные данные в следующих целях:</p>
            <ul className="list-disc list-inside mt-3 space-y-2">
              <li>Предоставление доступа к Сервису и его функциям</li>
              <li>Расчёт налоговых обязательств и формирование деклараций</li>
              <li>Отправка деклараций в государственные органы (КГД ИСНА) по вашему запросу</li>
              <li>Синхронизация банковских транзакций</li>
              <li>Отправка уведомлений о налоговых дедлайнах</li>
              <li>Предоставление AI-рекомендаций по оптимизации налогообложения</li>
              <li>Обеспечение безопасности аккаунта</li>
              <li>Выполнение требований законодательства Республики Казахстан</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-[20px] text-white mb-3">4. Правовое основание обработки</h2>
            <p>Обработка персональных данных осуществляется на основании:</p>
            <ul className="list-disc list-inside mt-3 space-y-2">
              <li>Согласия субъекта персональных данных (ст. 9 Закона о персональных данных)</li>
              <li>Исполнения договора (предоставление услуг Сервиса)</li>
              <li>Исполнения обязательств, предусмотренных налоговым законодательством РК</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-[20px] text-white mb-3">5. Хранение данных</h2>
            <p>
              <strong className="text-white">Персональные данные хранятся на серверах, расположенных на территории
              Республики Казахстан.</strong> Это соответствует требованиям статьи 14 Закона о персональных данных,
              которая устанавливает, что при трансграничной передаче персональных данных необходимо
              обеспечить адекватную защиту прав субъектов персональных данных.
            </p>
            <p className="mt-3">
              Сроки хранения данных:
            </p>
            <ul className="list-disc list-inside mt-3 space-y-2">
              <li><strong className="text-white">Данные аккаунта:</strong> в течение всего периода использования Сервиса + 3 года после удаления аккаунта</li>
              <li><strong className="text-white">Финансовые транзакции:</strong> 5 лет с момента создания (в соответствии с Налоговым кодексом РК)</li>
              <li><strong className="text-white">Налоговые декларации:</strong> 5 лет с момента подачи (в соответствии с Налоговым кодексом РК)</li>
              <li><strong className="text-white">Логи доступа:</strong> 1 год</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-[20px] text-white mb-3">6. Передача данных третьим лицам</h2>
            <p>Мы можем передавать ваши данные следующим категориям получателей:</p>
            <ul className="list-disc list-inside mt-3 space-y-2">
              <li><strong className="text-white">Государственные органы:</strong> Комитет государственных доходов (КГД) — только при отправке деклараций по вашему запросу</li>
              <li><strong className="text-white">Банки-партнёры:</strong> Kaspi Bank, Halyk Bank, Forte Bank — только при подключении банковской интеграции</li>
              <li><strong className="text-white">AI-провайдеры:</strong> Google (Gemini) — обезличенные данные для категоризации транзакций и генерации рекомендаций</li>
            </ul>
            <p className="mt-3">
              Мы не продаём ваши персональные данные третьим лицам и не передаём их в маркетинговых целях.
            </p>
          </section>

          <section>
            <h2 className="font-display text-[20px] text-white mb-3">7. Права субъекта персональных данных</h2>
            <p>
              В соответствии со статьёй 12 Закона о персональных данных, вы имеете право:
            </p>
            <ul className="list-disc list-inside mt-3 space-y-2">
              <li>Получать информацию о наличии и составе ваших персональных данных</li>
              <li>Получать доступ к вашим персональным данным</li>
              <li>Требовать исправления неточных персональных данных</li>
              <li>Требовать удаления персональных данных (с учётом сроков хранения, установленных законодательством)</li>
              <li>Отзывать согласие на обработку персональных данных</li>
              <li>Обращаться в уполномоченный орган по защите прав субъектов персональных данных</li>
            </ul>
            <p className="mt-3">
              Для реализации ваших прав обращайтесь по адресу:{' '}
              <a href="mailto:privacy@nalogai.kz" className="text-green hover:text-green-dim transition-colors duration-150">
                privacy@nalogai.kz
              </a>
            </p>
          </section>

          <section>
            <h2 className="font-display text-[20px] text-white mb-3">8. Безопасность данных</h2>
            <p>Мы применяем следующие меры для защиты ваших персональных данных:</p>
            <ul className="list-disc list-inside mt-3 space-y-2">
              <li>Шифрование данных при передаче (TLS 1.3)</li>
              <li>Хеширование паролей (bcrypt, 12 раундов)</li>
              <li>Шифрование банковских токенов (AES-256)</li>
              <li>Контроль доступа на основе ролей</li>
              <li>Регулярное резервное копирование базы данных</li>
              <li>Мониторинг и логирование всех действий с персональными данными</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-[20px] text-white mb-3">9. Файлы cookie</h2>
            <p>
              Сервис использует файлы cookie для обеспечения работоспособности (аутентификация,
              сессии) и улучшения пользовательского опыта. Вы можете управлять настройками cookie
              в вашем браузере.
            </p>
          </section>

          <section>
            <h2 className="font-display text-[20px] text-white mb-3">10. Изменения политики</h2>
            <p>
              Компания оставляет за собой право вносить изменения в настоящую Политику.
              О существенных изменениях пользователи будут уведомлены по электронной почте
              или через интерфейс Сервиса не менее чем за 7 дней до вступления изменений в силу.
            </p>
          </section>

          <section>
            <h2 className="font-display text-[20px] text-white mb-3">11. Контактная информация</h2>
            <p>
              По вопросам, связанным с обработкой персональных данных, обращайтесь:
            </p>
            <div className="mt-3 space-y-1">
              <p>
                Email:{' '}
                <a href="mailto:privacy@nalogai.kz" className="text-green hover:text-green-dim transition-colors duration-150">
                  privacy@nalogai.kz
                </a>
              </p>
              <p>ТОО «NalogAI», Республика Казахстан</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
