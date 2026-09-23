import {
  faChartLine,
  faCheck,
  faCode,
  faCopy,
  faExclamationTriangle,
  faEye,
  faPencil,
  faPlus,
  faTrash,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Button, LabelledInput, LabelledSelect, SimpleCard, Table } from '@shlinkio/shlink-frontend-kit';
import type { FormEvent } from 'react';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { Link, useFetcher } from 'react-router';
import { apiClientBuilder as defaultApiClientBuilder } from '../api/apiClientBuilder.server';
import { serverContainer } from '../container/container.server';
import { authMiddleware, sessionContext } from '../middleware/middleware.server';
import { buildPixelSnippet, buildVisitsPath, validatePixelSlug } from '../pixels/pixels';
import type { Pixel, PixelDomain } from '../pixels/PixelsService.server';
import { PixelsService, PixelValidationError } from '../pixels/PixelsService.server';
import { ServersService } from '../servers/ServersService.server';
import type { Route } from './+types/server.$serverId.pixels';
import type { RouteComponentProps } from './types';

export const middleware = [authMiddleware];

const DOMAIN_STORAGE_KEY = 'shlink-dashboard.pixels.domain';
const FALLBACK_URL_STORAGE_KEY = 'shlink-dashboard.pixels.fallbackUrl';

type PixelsLoaderData = {
  serverId: string;
  serverName: string;
  pixels: Pixel[];
  domains: PixelDomain[];
  error?: string;
};

type ActionResult = { success: true; message: string } | { success: false; error: string };

async function resolvePixelsService(
  serverId: string | undefined,
  userPublicId: string,
  serversService: ServersService,
  apiClientBuilder: typeof defaultApiClientBuilder,
) {
  if (!serverId) {
    throw new Response('Server ID required', { status: 400 });
  }

  const server = await serversService.getByPublicIdAndUser(serverId, userPublicId);
  return { server, pixelsService: new PixelsService(apiClientBuilder(server)) };
}

export async function loader(
  { params, context }: LoaderFunctionArgs,
  serversService: ServersService = serverContainer[ServersService.name],
  apiClientBuilder: typeof defaultApiClientBuilder = defaultApiClientBuilder,
): Promise<PixelsLoaderData> {
  const session = context.get(sessionContext);
  const serverId = params.serverId!;
  const { server, pixelsService } = await resolvePixelsService(
    params.serverId,
    session.publicId,
    serversService,
    apiClientBuilder,
  );

  try {
    const [pixels, domains] = await Promise.all([pixelsService.listPixels(), pixelsService.listDomains()]);
    return { serverId, serverName: server.name, pixels, domains };
  } catch (error: any) {
    return { serverId, serverName: server.name, pixels: [], domains: [], error: error.detail ?? error.message };
  }
}

export async function action(
  { request, params, context }: ActionFunctionArgs,
  serversService: ServersService = serverContainer[ServersService.name],
  apiClientBuilder: typeof defaultApiClientBuilder = defaultApiClientBuilder,
): Promise<ActionResult> {
  const session = context.get(sessionContext);
  const { pixelsService } = await resolvePixelsService(
    params.serverId,
    session.publicId,
    serversService,
    apiClientBuilder,
  );

  const data = await request.json();

  try {
    switch (data.action) {
      case 'create': {
        const shortUrl = await pixelsService.createPixel({
          name: data.name ?? '',
          fallbackUrl: data.fallbackUrl ?? '',
          customSlug: data.customSlug,
          domain: data.domain,
        });
        return { success: true, message: `Pixel "${shortUrl.title ?? shortUrl.shortCode}" created` };
      }
      case 'rename': {
        await pixelsService.renamePixel(data.shortCode, data.domain ?? null, data.name ?? '');
        return { success: true, message: 'Pixel renamed' };
      }
      case 'delete': {
        await pixelsService.deletePixel(data.shortCode, data.domain ?? null);
        return { success: true, message: 'Pixel deleted' };
      }
      default:
        return { success: false, error: 'Invalid action' };
    }
  } catch (error: any) {
    if (error instanceof PixelValidationError) {
      return { success: false, error: error.message };
    }

    // Shlink API errors carry a human-readable detail
    return { success: false, error: error.detail ?? error.message ?? 'Unexpected error' };
  }
}

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

const noopSubscribe = () => () => {};

/**
 * Reads a value from browser storage. It is null during server-side rendering, where storage is not available.
 */
function useStoredValue(key: string): string | null {
  return useSyncExternalStore(
    noopSubscribe,
    () => readStorage(key),
    () => null,
  );
}

function writeStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage may be unavailable (private mode, blocked site data). Remembering values is only a convenience.
  }
}

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTime(isoDate: string): string {
  return new Date(isoDate).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function CopyButton({ value, label, icon }: { value: string; label: string; icon: typeof faCopy }) {
  const [copied, setCopied] = useState(false);
  const timeout = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timeout.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      clearTimeout(timeout.current);
      timeout.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy this value', value);
    }
  };

  return (
    <Button variant="secondary" size="sm" onClick={copy} title={label} aria-label={label}>
      <FontAwesomeIcon icon={copied ? faCheck : icon} />
    </Button>
  );
}

function StatCard({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="flex-1 min-w-36 p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-2xl font-bold tabular-nums">{value.toLocaleString()}</div>
      {hint && <div className="text-xs text-gray-500">{hint}</div>}
    </div>
  );
}

function CreatePixelForm({ domains }: { domains: PixelDomain[] }) {
  const fetcher = useFetcher<ActionResult>();
  const defaultDomain = domains.find((d) => d.isDefault)?.domain ?? '';
  const [name, setName] = useState('');
  const [customSlug, setCustomSlug] = useState('');
  // Null until the user picks a value, so that the last used one (read from browser storage) is used meanwhile
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [typedFallbackUrl, setTypedFallbackUrl] = useState<string | null>(null);
  const storedDomain = useStoredValue(DOMAIN_STORAGE_KEY);
  const storedFallbackUrl = useStoredValue(FALLBACK_URL_STORAGE_KEY);

  const domain =
    selectedDomain ?? (storedDomain && domains.some((d) => d.domain === storedDomain) ? storedDomain : defaultDomain);
  const fallbackUrl = typedFallbackUrl ?? storedFallbackUrl ?? '';

  // Clear per-pixel fields once a pixel has been created
  const [handledResult, setHandledResult] = useState(fetcher.data);
  if (fetcher.state === 'idle' && fetcher.data !== handledResult) {
    setHandledResult(fetcher.data);
    if (fetcher.data?.success) {
      setName('');
      setCustomSlug('');
    }
  }

  const slugError = customSlug.trim() ? validatePixelSlug(customSlug.trim()) : undefined;
  const isSubmitting = fetcher.state !== 'idle';

  const submit = (e: FormEvent) => {
    e.preventDefault();
    writeStorage(DOMAIN_STORAGE_KEY, domain);
    writeStorage(FALLBACK_URL_STORAGE_KEY, fallbackUrl.trim());
    void fetcher.submit(
      {
        action: 'create',
        name: name.trim(),
        fallbackUrl: fallbackUrl.trim(),
        ...(customSlug.trim() ? { customSlug: customSlug.trim() } : {}),
        ...(domain && domain !== defaultDomain ? { domain } : {}),
      },
      { method: 'POST', encType: 'application/json' },
    );
  };

  return (
    <SimpleCard title="Create pixel">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid gap-4 md:grid-cols-2">
          <LabelledInput
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Email signature – William"
            required
          />
          <LabelledSelect label="Domain" value={domain} onChange={(e) => setSelectedDomain(e.target.value)}>
            {domains.map((d) => (
              <option key={d.domain} value={d.domain}>
                {d.domain}
                {d.isDefault ? ' (default)' : ''}
              </option>
            ))}
          </LabelledSelect>
          <LabelledInput
            label="Fallback URL"
            type="url"
            value={fallbackUrl}
            onChange={(e) => setTypedFallbackUrl(e.target.value)}
            placeholder="https://example.com"
            required
          />
          <LabelledInput
            label="Custom slug (optional)"
            value={customSlug}
            onChange={(e) => setCustomSlug(e.target.value)}
            placeholder="Leave empty to generate one"
          />
        </div>
        <p className="text-sm text-gray-500 -mt-2">
          The fallback URL is only used if someone opens the pixel link directly in a browser.
        </p>
        {slugError && <div className="text-danger text-sm">{slugError}</div>}
        {fetcher.data && !fetcher.data.success && fetcher.state === 'idle' && (
          <div className="text-danger text-sm">{fetcher.data.error}</div>
        )}
        {fetcher.data?.success && fetcher.state === 'idle' && (
          <div className="text-green-600 text-sm">{fetcher.data.message}</div>
        )}
        <div>
          <Button type="submit" solid disabled={isSubmitting || !!slugError}>
            <FontAwesomeIcon icon={faPlus} /> {isSubmitting ? 'Creating…' : 'Create pixel'}
          </Button>
        </div>
      </form>
    </SimpleCard>
  );
}

function PixelRow({ pixel, serverId }: { pixel: Pixel; serverId: string }) {
  const fetcher = useFetcher<ActionResult>();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(pixel.name);
  const isBusy = fetcher.state !== 'idle';

  // Leave edit mode once a rename has succeeded
  const [handledResult, setHandledResult] = useState(fetcher.data);
  if (fetcher.state === 'idle' && fetcher.data !== handledResult) {
    setHandledResult(fetcher.data);
    if (fetcher.data?.success) {
      setEditing(false);
    }
  }

  const rename = () => {
    void fetcher.submit(
      { action: 'rename', shortCode: pixel.shortCode, domain: pixel.domain, name: name.trim() },
      { method: 'POST', encType: 'application/json' },
    );
  };
  const remove = () => {
    if (!window.confirm(`Delete pixel "${pixel.name}"? Its visits will be deleted too.`)) {
      return;
    }
    void fetcher.submit(
      { action: 'delete', shortCode: pixel.shortCode, domain: pixel.domain },
      { method: 'POST', encType: 'application/json' },
    );
  };

  return (
    <Table.Row className={isBusy ? 'opacity-60' : undefined}>
      <Table.Cell className="max-w-xs">
        {editing ? (
          <div className="flex gap-2">
            <LabelledInput
              label="Pixel name"
              hiddenRequired
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && rename()}
            />
            <Button size="sm" solid onClick={rename} disabled={isBusy || !name.trim()}>
              Save
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setName(pixel.name);
                setEditing(false);
              }}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <div className="font-medium truncate" title={pixel.name}>
            {pixel.name}
          </div>
        )}
        <code className="text-xs text-gray-500 break-all">{pixel.pixelUrl}</code>
        {fetcher.data && !fetcher.data.success && fetcher.state === 'idle' && (
          <div className="text-danger text-xs">{fetcher.data.error}</div>
        )}
      </Table.Cell>
      <Table.Cell className="tabular-nums font-bold">{pixel.opens.toLocaleString()}</Table.Cell>
      <Table.Cell className="tabular-nums">{pixel.opensLast7Days.toLocaleString()}</Table.Cell>
      <Table.Cell className="tabular-nums text-gray-500">{pixel.botHits.toLocaleString()}</Table.Cell>
      <Table.Cell className="whitespace-nowrap">
        {pixel.lastOpened ? formatDateTime(pixel.lastOpened) : <span className="text-gray-500">Never</span>}
      </Table.Cell>
      <Table.Cell className="whitespace-nowrap">{formatDate(pixel.dateCreated)}</Table.Cell>
      <Table.Cell>
        <div className="flex gap-1">
          <CopyButton value={buildPixelSnippet(pixel.pixelUrl)} label="Copy HTML snippet" icon={faCode} />
          <CopyButton value={pixel.pixelUrl} label="Copy pixel URL" icon={faCopy} />
          <Link
            to={buildVisitsPath(serverId, pixel.shortCode, pixel.domain)}
            className="inline-flex items-center px-2 py-1 rounded border border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white transition-colors"
            title="View visits"
            aria-label="View visits"
          >
            <FontAwesomeIcon icon={faChartLine} />
          </Link>
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)} title="Rename" aria-label="Rename">
            <FontAwesomeIcon icon={faPencil} />
          </Button>
          <Button variant="danger" size="sm" onClick={remove} disabled={isBusy} title="Delete" aria-label="Delete">
            <FontAwesomeIcon icon={faTrash} />
          </Button>
        </div>
      </Table.Cell>
    </Table.Row>
  );
}

export default function Pixels({ loaderData }: RouteComponentProps<Route.ComponentProps>) {
  const { serverId, serverName, pixels, domains, error } = loaderData as PixelsLoaderData;

  const totalOpens = pixels.reduce((sum, p) => sum + p.opens, 0);
  const totalRecent = pixels.reduce((sum, p) => sum + p.opensLast7Days, 0);
  const totalBots = pixels.reduce((sum, p) => sum + p.botHits, 0);

  return (
    <main className="container py-4 mx-auto flex flex-col gap-4">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold">
          <FontAwesomeIcon icon={faEye} className="text-blue-600" />
          Tracking pixels
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          <strong>{serverName}</strong> &bull; {pixels.length} pixel{pixels.length !== 1 ? 's' : ''}
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 border border-red-300 dark:border-red-700">
          <FontAwesomeIcon icon={faExclamationTriangle} />
          <div>
            <strong>Error fetching pixels:</strong> {error}
          </div>
        </div>
      )}

      {!error && (
        <>
          <div className="flex flex-wrap gap-4">
            <StatCard label="Pixels" value={pixels.length} />
            <StatCard label="Opens" value={totalOpens} hint="Bots excluded" />
            <StatCard label="Opens (last 7 days)" value={totalRecent} hint="Bots excluded" />
            <StatCard label="Bot hits" value={totalBots} hint="Security scanners, prefetchers" />
          </div>

          <CreatePixelForm domains={domains} />

          {pixels.length === 0 ? (
            <SimpleCard bodyClassName="text-center py-8">
              <FontAwesomeIcon icon={faEye} className="text-gray-400 text-5xl mb-4" />
              <h4 className="mb-2">No pixels yet</h4>
              <p className="text-gray-500 text-sm max-w-md mx-auto">
                Create a pixel above, then paste its HTML snippet into an email signature or web page.
              </p>
            </SimpleCard>
          ) : (
            <SimpleCard title={`${pixels.length} pixel${pixels.length !== 1 ? 's' : ''}`}>
              <Table
                header={
                  <Table.Row>
                    <Table.Cell>Pixel</Table.Cell>
                    <Table.Cell>Opens</Table.Cell>
                    <Table.Cell>Last 7 days</Table.Cell>
                    <Table.Cell>Bot hits</Table.Cell>
                    <Table.Cell>Last opened</Table.Cell>
                    <Table.Cell>Created</Table.Cell>
                    <Table.Cell>Actions</Table.Cell>
                  </Table.Row>
                }
              >
                {pixels.map((pixel) => (
                  <PixelRow key={`${pixel.domain ?? ''}/${pixel.shortCode}`} pixel={pixel} serverId={serverId} />
                ))}
              </Table>
            </SimpleCard>
          )}

          <details className="p-4 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <summary className="cursor-pointer font-medium">How pixel counts work</summary>
            <ul className="list-disc ml-6 mt-2 flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-400">
              <li>
                A pixel is a short URL tagged &quot;pixel&quot;. Loading its URL records a visit and returns an
                invisible image.
              </li>
              <li>
                Apple Mail loads images on delivery, so it counts as an open even if the email was never read. Gmail
                caches images, so repeat opens may not be counted. Outlook blocks images until the reader allows them.
              </li>
              <li>
                Security scanners often load images too. Shlink flags them as bots, and they are excluded from opens.
              </li>
              <li>Treat opens as a delivery signal. Clicks on short links are the reliable measure of interest.</li>
            </ul>
          </details>
        </>
      )}

      <Link to={`/server/${serverId}`} className="text-blue-600 hover:underline">
        &larr; Back to Server
      </Link>
    </main>
  );
}
