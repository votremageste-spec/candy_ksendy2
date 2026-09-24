/**
 * Статическая страница политики конфиденциальности (152-ФЗ).
 *
 * Контакты оператора заполнены. Текст остаётся рабочим шаблоном, а не
 * юридическим заключением: состав обязательных сведений зависит от того,
 * как именно ведётся деятельность, поэтому документ стоит показать юристу
 * перед публикацией сайта.
 */

import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { BRAND } from '@/data/brand';

/** Оператор персональных данных. */
const OPERATOR = {
  fullName: 'Епифанова Ксения Сергеевна',
  status: 'самозанятая (налог на профессиональный доход)',
  region: 'г. Химки, Московская область',
  inn: '632150283526',
  email: 'klavdija0008@gmail.com',
} as const;

/** Дата последнего изменения документа. Обновляйте при правках текста. */
const UPDATED_AT = '23 августа 2026 года';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-[16px] leading-[1.4] font-medium text-text-primary">{title}</h2>
      <div className="mt-3 flex flex-col gap-3 text-[14px] leading-[1.7] text-text-muted">
        {children}
      </div>
    </section>
  );
}

export function PrivacyPolicyScreen() {
  const navigate = useNavigate();

  return (
    <>
      <Header onBack={() => navigate(-1)} />

      <main className="mx-auto max-w-[720px] px-4 py-8 pb-16">
        <h1 className="text-[clamp(22px,5vw,28px)] leading-[1.2] font-medium tracking-[-0.02em] text-text-primary">
          Политика конфиденциальности
        </h1>
        <p className="mt-2 text-[13px] text-text-muted">Редакция от {UPDATED_AT}</p>

        <div className="mt-6 rounded-[14px] border border-border bg-surface p-5">
          <dl className="flex flex-col gap-2 text-[14px] leading-[1.6]">
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-text-muted">Оператор:</dt>
              <dd className="text-text-primary">{OPERATOR.fullName}</dd>
            </div>
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-text-muted">Статус:</dt>
              <dd className="text-text-primary">{OPERATOR.status}</dd>
            </div>
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-text-muted">Регион:</dt>
              <dd className="text-text-primary">{OPERATOR.region}</dd>
            </div>
          </dl>
        </div>

        <Section title="1. Общие положения">
          <p>
            Настоящая политика определяет порядок обработки персональных данных пользователей
            сервиса {BRAND.name} (далее — Сервис) и меры по обеспечению их безопасности.
            Политика разработана в соответствии с Федеральным законом от 27.07.2006 № 152-ФЗ
            «О персональных данных».
          </p>
          <p>
            Отправляя заявку через форму Сервиса и отмечая соответствующий чекбокс, вы даёте
            согласие на обработку своих персональных данных на условиях настоящей политики.
          </p>
        </Section>

        <Section title="2. Какие данные мы собираем">
          <p>Оператор обрабатывает следующие данные, которые вы сообщаете добровольно:</p>
          <ul className="flex list-disc flex-col gap-1.5 pl-5">
            <li>имя, которым вы просите к вам обращаться;</li>
            <li>номер телефона;</li>
            <li>имя пользователя в Telegram — если вы его указали;</li>
            <li>желаемые дата и время получения заказа;</li>
            <li>состав выбранного десерта и ваши пожелания к нему.</li>
          </ul>
          <p>
            Дополнительно автоматически сохраняется технический идентификатор, полученный из
            IP-адреса, — исключительно для защиты формы от автоматических рассылок. Сам адрес
            не сохраняется: он преобразуется необратимо и удаляется в течение десяти минут.
          </p>
          <p>
            Оператор не собирает специальные категории персональных данных и не обрабатывает
            биометрические данные. Если в поле «Пожелания» вы указываете сведения о пищевой
            непереносимости, они используются только для приготовления заказа.
          </p>
        </Section>

        <Section title="3. Зачем нам эти данные">
          <ul className="flex list-disc flex-col gap-1.5 pl-5">
            <li>связаться с вами для подтверждения заявки и уточнения деталей;</li>
            <li>согласовать дату, время и место передачи заказа;</li>
            <li>приготовить десерт согласно вашему выбору;</li>
            <li>вести учёт заявок.</li>
          </ul>
          <p>
            Данные не используются для рекламных рассылок и не передаются третьим лицам
            в маркетинговых целях.
          </p>
        </Section>

        <Section title="4. Кому передаются данные">
          <p>
            Для работы Сервиса используются сторонние сервисы, выступающие обработчиками
            по поручению оператора:
          </p>
          <ul className="flex list-disc flex-col gap-1.5 pl-5">
            <li>Google LLC — хранение базы заявок и таблицы учёта;</li>
            <li>Vercel Inc. — размещение сайта и обработка отправленных форм;</li>
            <li>Telegram Messenger — доставка уведомления о новой заявке.</li>
          </ul>
          <p>
            Обработка данных указанными сервисами может осуществляться за пределами Российской
            Федерации. Отправляя заявку, вы даёте согласие на трансграничную передачу данных
            на условиях настоящей политики.
          </p>
        </Section>

        <Section title="5. Сколько мы храним данные">
          <p>
            Данные заявки хранятся до момента выполнения заказа и в течение трёх лет после
            него — для разрешения возможных спорных ситуаций. По вашему требованию данные
            удаляются раньше этого срока.
          </p>
        </Section>

        <Section title="6. Как мы защищаем данные">
          <p>
            Доступ к базе заявок закрыт для посетителей сайта: записи создаются только
            серверной частью Сервиса по защищённому ключу. Доступ к таблице учёта имеет
            оператор и сервисная учётная запись Сервиса.
          </p>
        </Section>

        <Section title="7. Ваши права">
          <p>Вы вправе в любой момент:</p>
          <ul className="flex list-disc flex-col gap-1.5 pl-5">
            <li>запросить сведения об обработке ваших данных;</li>
            <li>потребовать уточнения, блокирования или уничтожения данных;</li>
            <li>отозвать согласие на обработку.</li>
          </ul>
          <p>
            Для этого напишите оператору по контактам из раздела 8. Отзыв согласия до
            выполнения заказа означает отмену заявки: без контактных данных согласовать
            и передать заказ невозможно.
          </p>
        </Section>

        <Section title="8. Контакты оператора">
          <p>
            По любым вопросам об обработке персональных данных, а также для отзыва
            согласия обращайтесь к оператору:
          </p>
          <dl className="flex flex-col gap-2 rounded-[10px] border border-border bg-surface-hover p-4 text-text-primary">
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-text-muted">Оператор:</dt>
              <dd>{OPERATOR.fullName}</dd>
            </div>
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-text-muted">Статус:</dt>
              <dd>{OPERATOR.status}</dd>
            </div>
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-text-muted">ИНН:</dt>
              <dd>{OPERATOR.inn}</dd>
            </div>
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-text-muted">Электронная почта:</dt>
              <dd>
                <a
                  href={`mailto:${OPERATOR.email}`}
                  className="text-primary underline underline-offset-2"
                >
                  {OPERATOR.email}
                </a>
              </dd>
            </div>
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-text-muted">Регион:</dt>
              <dd>{OPERATOR.region}</dd>
            </div>
          </dl>
          <p>
            Ответ на обращение направляется в срок, установленный частью 1 статьи 20
            Федерального закона № 152-ФЗ.
          </p>
        </Section>

        <Section title="9. Изменения политики">
          <p>
            Оператор вправе изменять настоящую политику. Актуальная редакция всегда доступна
            по этому адресу; дата последнего изменения указана в начале документа.
          </p>
        </Section>

        <p className="mt-10 text-center text-[12px] text-text-muted">
          © {new Date().getFullYear()} {BRAND.name}
        </p>
      </main>
    </>
  );
}
