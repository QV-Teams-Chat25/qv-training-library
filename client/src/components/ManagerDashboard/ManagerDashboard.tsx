import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  deleteProcessDraft,
  deleteRebuttalDraft,
  deleteTransitionsDraft,
  getLiveRebuttals,
  getProcess,
  getRebuttals,
  RebuttalValue,
  RebuttalsMap,
  getTransitions,
  ProcessMap,
  ProcessValue,
  publishLive,
  saveProcess,
  saveRebuttals,
  saveTransitions,
  TransitionFileRef,
} from '../../apiService';

const legalLine1 = 'Copyright © 2026 Quality Voices LLC. All rights reserved. Confidential and proprietary information for authorized business use only.';
const legalLine2 = 'IT Legal Notice: Unauthorized access, use, disclosure, copying, or distribution is prohibited and may result in disciplinary action, civil liability, and criminal penalties.';
const DEFAULT_PROCESS_DATA: ProcessMap = {
  'Call Process': '',
  Verification: '',
};
const DEFAULT_PROCESS_CATEGORY: 'Verification' = 'Verification';

const normalizeHtmlText = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const ALL_CAMPAIGNS = 'All';
const NEW_REBUTTAL_SENTINEL = '__new_rebuttal__';

type SavedRebuttalEntry = {
  campaign: string;
  title: string;
  content: string;
  deliveryTip: string;
};

const normalizeRebuttalEntry = (value: unknown, campaign: string, fallbackTitle: string): SavedRebuttalEntry | null => {
  if (typeof value === 'string') {
    return value.trim()
      ? { campaign, title: fallbackTitle || campaign, content: value, deliveryTip: '' }
      : null;
  }

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    const title = typeof record.title === 'string' && record.title.trim() ? record.title : fallbackTitle || campaign;
    const content = typeof record.content === 'string' ? record.content : '';
    const deliveryTip = typeof record.deliveryTip === 'string' ? record.deliveryTip : '';
    return content.trim() ? { campaign, title, content, deliveryTip } : null;
  }

  return null;
};

const getRebuttalEntries = (value: RebuttalValue | undefined, campaign: string): SavedRebuttalEntry[] => {
  if (!value) {
    return [];
  }

  const directEntry = normalizeRebuttalEntry(value, campaign, campaign);
  if (directEntry) {
    return [directEntry];
  }

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    return Object.keys(record)
      .map((key) => normalizeRebuttalEntry(record[key], campaign, key))
      .filter((entry): entry is SavedRebuttalEntry => entry !== null);
  }

  return [];
};

const getScriptFromRebuttalValue = (value: RebuttalValue | undefined, campaign: string) => {
  const [firstEntry] = getRebuttalEntries(value, campaign);
  return firstEntry || {
    campaign,
    title: campaign,
    content: '',
    deliveryTip: '',
  };
};

const hasScriptValue = (value: RebuttalValue | undefined, campaign: string) => getRebuttalEntries(value, campaign).length > 0;

const buildAllCampaignsHtml = (working: RebuttalsMap, live: RebuttalsMap, campaigns: string[]) => {
  const sections = campaigns
    .flatMap((campaign) => {
      const workingEntries = getRebuttalEntries(working[campaign], campaign);
      const liveEntries = getRebuttalEntries(live[campaign], campaign);
      const chosenEntries = workingEntries.length ? workingEntries : liveEntries;

      return chosenEntries.map((entry) => `<section style="margin-bottom:24px;"><h3 style="margin:0 0 8px 0;color:#1f3f6b;">${entry.title || campaign}</h3><div>${entry.content}</div></section>`);
    })
    .filter(Boolean)
    .join('');

  return sections || '<p style="color:#6b7280;">No saved scripts found across campaigns.</p>';
};

const buildRebuttalBucket = (value: RebuttalValue | undefined, campaign: string) => {
  return getRebuttalEntries(value, campaign).reduce<Record<string, { title: string; content: string; deliveryTip: string }>>((bucket, entry) => {
    bucket[entry.title] = {
      title: entry.title,
      content: entry.content,
      deliveryTip: entry.deliveryTip || '',
    };
    return bucket;
  }, {});
};

const getNextUntitledRebuttalTitle = (entries: SavedRebuttalEntry[]) => {
  const usedTitles = new Set(entries.map((entry) => entry.title.trim().toLowerCase()));
  if (!usedTitles.has('new rebuttal')) {
    return 'New Rebuttal';
  }

  let index = 2;
  while (usedTitles.has(`new rebuttal ${index}`.toLowerCase())) {
    index += 1;
  }

  return `New Rebuttal ${index}`;
};

const getProcessEntries = (value: ProcessValue, category: 'Call Process' | 'Verification') => {
  if (typeof value === 'string') {
    return value.trim() ? [{ title: category, content: value }] : [];
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    if ('title' in record || 'content' in record) {
      const title = typeof record.title === 'string' ? record.title : category;
      const content = typeof record.content === 'string' ? record.content : '';
      return content.trim() ? [{ title, content }] : [];
    }
    return Object.keys(record)
      .map((key) => {
        const content = record[key];
        if (typeof content !== 'string' || !content.trim()) {
          return null;
        }
        return { title: key, content };
      })
      .filter((entry): entry is { title: string; content: string } => entry !== null);
  }
  return [] as Array<{ title: string; content: string }>;
};

const ManagerDashboard: React.FC = () => {
  const [view, setView] = useState<'menu' | 'rebuttals' | 'transitions' | 'process'>('menu');
  const [selectedClient, setSelectedClient] = useState('General');
  const [scriptTitle, setScriptTitle] = useState('General');
  const [selectedSavedRebuttalTitle, setSelectedSavedRebuttalTitle] = useState('');
  const [deliveryTip, setDeliveryTip] = useState('');
  const [selectedProcess, setSelectedProcess] = useState<'Verification'>(DEFAULT_PROCESS_CATEGORY);
  const [processScriptTitle, setProcessScriptTitle] = useState<string>(DEFAULT_PROCESS_CATEGORY);
  const [workingRebuttals, setWorkingRebuttals] = useState<RebuttalsMap>({});
  const [liveRebuttals, setLiveRebuttals] = useState<RebuttalsMap>({});
  const [rebuttalsLoading, setRebuttalsLoading] = useState(true);
  const [rebuttalsSaveMessage, setRebuttalsSaveMessage] = useState('');
  const [workingProcess, setWorkingProcess] = useState<ProcessMap>(DEFAULT_PROCESS_DATA);
  const [, setLiveProcess] = useState<ProcessMap>(DEFAULT_PROCESS_DATA);
  const [processLoading, setProcessLoading] = useState(true);
  const [workingTransition, setWorkingTransition] = useState<TransitionFileRef | null>(null);
  const [liveTransition, setLiveTransition] = useState<TransitionFileRef | null>(null);
  const [pendingTransition, setPendingTransition] = useState<TransitionFileRef | null>(null);
  const [transitionsLoading, setTransitionsLoading] = useState(true);
  const [transitionsSaveMessage, setTransitionsSaveMessage] = useState('');
  const rebuttalsEditorRef = useRef<HTMLDivElement>(null);
  const processEditorRef = useRef<HTMLDivElement>(null);
  const savedSelectionRef = useRef<{ rebuttals: Range | null; process: Range | null }>({ rebuttals: null, process: null });

  const clients = [
    ALL_CAMPAIGNS,
    'General',
    'Brown (NNL, PD)',
    'Cruz ($250+ PD, MR, ND, PD)',
    'NRS (NNL, PD)',
    'Paxton (NNL, PD)',
    'Presidential Victory Fund PD',
    'RNC (NNL, Sp NNL, Sp PD $250+, Sp PD, UNF PD)',
    'SCF NNL',
    'TPP PD',
  ];

  const getActiveEditor = () => (view === 'process' ? processEditorRef.current : rebuttalsEditorRef.current);
  const getSelectionBucketKey = () => (view === 'process' ? 'process' : 'rebuttals');

  const saveCurrentSelection = () => {
    if (typeof window === 'undefined') {
      return;
    }

    const editor = getActiveEditor();
    const selection = window.getSelection();
    if (!editor || !selection || selection.rangeCount === 0) {
      return;
    }

    const range = selection.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) {
      return;
    }

    savedSelectionRef.current[getSelectionBucketKey()] = range.cloneRange();
  };

  const restoreCurrentSelection = () => {
    if (typeof window === 'undefined') {
      return;
    }

    const editor = getActiveEditor();
    const selection = window.getSelection();
    if (!editor || !selection) {
      return;
    }

    editor.focus();
    const savedRange = savedSelectionRef.current[getSelectionBucketKey()];
    if (savedRange) {
      selection.removeAllRanges();
      selection.addRange(savedRange);
    }
  };

  const handleToolbarMouseDown = (event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault();
    restoreCurrentSelection();
  };

  const applyToolbarCommand = (event: React.MouseEvent<HTMLElement>, command: string, value?: string) => {
    event.preventDefault();
    restoreCurrentSelection();
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand(command, false, value);
    saveCurrentSelection();
  };

  const handleFormat = (command: string, value?: string) => {
    restoreCurrentSelection();
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand(command, false, value);
    saveCurrentSelection();
  };

  const handleHighlight = (value: string) => {
    if (!value) {
      return;
    }
    restoreCurrentSelection();
    document.execCommand('styleWithCSS', false, 'true');
    const applied = document.execCommand('hiliteColor', false, value);
    if (!applied) {
      document.execCommand('backColor', false, value);
    }
    saveCurrentSelection();
  };

  const insertPresentationBreak = () => {
    if (selectedClient === ALL_CAMPAIGNS || !rebuttalsEditorRef.current) {
      return;
    }

    rebuttalsEditorRef.current.focus();
    const breakHtml = `
      <div data-qv-break="presentation" style="margin:16px 0;padding:8px 10px;border-top:2px dashed #1e67cc;border-bottom:2px dashed #1e67cc;color:#1e67cc;font-weight:700;text-align:center;">
        3RD PRESENTATION STARTS BELOW
      </div>
      <p><br></p>
    `.trim();

    document.execCommand('insertHTML', false, breakHtml);
    setRebuttalsSaveMessage('Inserted: 3rd Presentation break');
  };

  useEffect(() => {
    const loadRebuttals = async () => {
      setRebuttalsLoading(true);
      try {
        const data = await getRebuttals();
        setWorkingRebuttals(data.working || {});
        setLiveRebuttals(data.live || {});
      } finally {
        setRebuttalsLoading(false);
      }
    };

    loadRebuttals();
  }, []);

  useEffect(() => {
    const loadProcess = async () => {
      setProcessLoading(true);
      try {
        const data = await getProcess();
        setWorkingProcess(data.working || DEFAULT_PROCESS_DATA);
        setLiveProcess(data.live || DEFAULT_PROCESS_DATA);
      } finally {
        setProcessLoading(false);
      }
    };

    loadProcess();
  }, []);

  useEffect(() => {
    const loadTransitions = async () => {
      setTransitionsLoading(true);
      try {
        const data = await getTransitions();
        setWorkingTransition(data.working || null);
        setLiveTransition(data.live || null);
        setPendingTransition(data.working || null);
      } finally {
        setTransitionsLoading(false);
      }
    };

    loadTransitions();
  }, []);

  useEffect(() => {
    if (!rebuttalsEditorRef.current) {
      return;
    }
    if (rebuttalsLoading) {
      rebuttalsEditorRef.current.innerText = 'Loading...';
      return;
    }
    if (selectedClient === ALL_CAMPAIGNS) {
      setScriptTitle('All Campaign Scripts');
      setSelectedSavedRebuttalTitle('');
      setDeliveryTip('');
      rebuttalsEditorRef.current.innerHTML = buildAllCampaignsHtml(workingRebuttals, liveRebuttals, clients.filter((campaign) => campaign !== ALL_CAMPAIGNS));
      return;
    }
    const workingEntries = selectedClient ? getRebuttalEntries(workingRebuttals[selectedClient], selectedClient) : [];
    const liveEntries = selectedClient ? getRebuttalEntries(liveRebuttals[selectedClient], selectedClient) : [];
    const availableEntries = workingEntries.length ? workingEntries : liveEntries;

    if (selectedSavedRebuttalTitle === NEW_REBUTTAL_SENTINEL) {
      const nextTitle = scriptTitle && scriptTitle !== selectedClient ? scriptTitle : getNextUntitledRebuttalTitle(availableEntries);
      setScriptTitle(nextTitle);
      setDeliveryTip('');
      rebuttalsEditorRef.current.innerHTML = '';
      return;
    }

    const nextScript = availableEntries.find((entry) => entry.title === selectedSavedRebuttalTitle) || availableEntries[0] || { campaign: selectedClient, title: selectedClient, content: '', deliveryTip: '' };

    setSelectedSavedRebuttalTitle(nextScript.title || '');
    setScriptTitle(nextScript.title || selectedClient);
    setDeliveryTip(nextScript.deliveryTip || '');
    rebuttalsEditorRef.current.innerHTML = nextScript.content || '';
  }, [selectedClient, selectedSavedRebuttalTitle, view, workingRebuttals, liveRebuttals, rebuttalsLoading]);

  useEffect(() => {
    if (!processEditorRef.current) {
      return;
    }
    if (processLoading) {
      processEditorRef.current.innerText = 'Loading...';
      return;
    }
    const processKey = selectedProcess;
    const entries = getProcessEntries(workingProcess[processKey], processKey);
    const selectedEntry = entries.find((entry) => entry.title === processScriptTitle) || entries[0] || { title: processKey, content: '' };
    setProcessScriptTitle(selectedEntry.title || processKey);
    processEditorRef.current.innerHTML = selectedEntry.content || '';
  }, [selectedProcess, processScriptTitle, view, workingProcess, processLoading]);

  const handleSaveRebuttals = async () => {
    if (selectedClient === ALL_CAMPAIGNS) {
      window.alert('Select a specific campaign to save edits. All view is read-only.');
      return;
    }
    if (!selectedClient || !rebuttalsEditorRef.current) {
      return;
    }
    const draftHtml = rebuttalsEditorRef.current.innerHTML.trim();
    const nextTitle = (scriptTitle || selectedClient).trim() || selectedClient;
    const nextBucket = buildRebuttalBucket(workingRebuttals[selectedClient], selectedClient);
    const previousTitle = selectedSavedRebuttalTitle && selectedSavedRebuttalTitle !== NEW_REBUTTAL_SENTINEL ? selectedSavedRebuttalTitle : '';

    if (previousTitle && previousTitle !== nextTitle) {
      delete nextBucket[previousTitle];
    }

    if (draftHtml || deliveryTip.trim()) {
      nextBucket[nextTitle] = {
        title: nextTitle,
        content: draftHtml,
        deliveryTip: deliveryTip.trim(),
      };
    } else {
      delete nextBucket[nextTitle];
    }

    const updated = {
      ...workingRebuttals,
      [selectedClient]: nextBucket,
    };

    if (Object.keys(nextBucket).length === 0) {
      delete updated[selectedClient];
    }

    try {
      setSelectedSavedRebuttalTitle(nextTitle);
      setWorkingRebuttals(updated);
      setRebuttalsSaveMessage('Saving...');
      await saveRebuttals(updated);

      const refreshed = await getRebuttals();
      setWorkingRebuttals(refreshed.working || {});
      setRebuttalsSaveMessage(`Saved: ${selectedClient}`);
    } catch {
      setRebuttalsSaveMessage('Save failed');
      window.alert('Error: Could not reach the server. Your changes were not saved.');
    }
  };

  const handleEditSavedRebuttal = (campaign: string, title: string) => {
    setView('rebuttals');
    setSelectedClient(campaign);
    setSelectedSavedRebuttalTitle(title);
    setScriptTitle(title);

    const candidateEntries = getRebuttalEntries(workingRebuttals[campaign], campaign).length
      ? getRebuttalEntries(workingRebuttals[campaign], campaign)
      : getRebuttalEntries(liveRebuttals[campaign], campaign);
    const selectedEntry = candidateEntries.find((entry) => entry.title === title);

    if (selectedEntry) {
      setDeliveryTip(selectedEntry.deliveryTip || '');
      if (rebuttalsEditorRef.current) {
        rebuttalsEditorRef.current.innerHTML = selectedEntry.content || '';
      }
    }
  };

  const handleDeleteSavedRebuttal = async (campaign: string, title: string) => {
    try {
      setRebuttalsSaveMessage('Deleting...');
      await deleteRebuttalDraft(campaign, title);
      const refreshed = await getRebuttals();
      setWorkingRebuttals(refreshed.working || {});
      setLiveRebuttals(refreshed.live || {});
      setRebuttalsSaveMessage(`Deleted: ${title}`);

      if (selectedClient === campaign && scriptTitle === title) {
        const remainingEntries = getRebuttalEntries((refreshed.working || {})[campaign], campaign);
        if (remainingEntries.length > 0) {
          const nextEntry = remainingEntries[0];
          setSelectedSavedRebuttalTitle(nextEntry.title);
          setScriptTitle(nextEntry.title);
          setDeliveryTip(nextEntry.deliveryTip || '');
          if (rebuttalsEditorRef.current) {
            rebuttalsEditorRef.current.innerHTML = nextEntry.content || '';
          }
        } else {
          setSelectedClient(ALL_CAMPAIGNS);
          setSelectedSavedRebuttalTitle('');
          setScriptTitle('All Campaign Scripts');
          setDeliveryTip('');
          if (rebuttalsEditorRef.current) {
            rebuttalsEditorRef.current.innerHTML = '';
          }
        }
      }
    } catch {
      setRebuttalsSaveMessage('Delete failed');
      window.alert('Error: Could not reach the server. Your changes were not saved.');
    }
  };

  const handleClearRebuttalForm = () => {
    if (selectedClient === ALL_CAMPAIGNS) {
      return;
    }

    const nextTitle = getNextUntitledRebuttalTitle(selectedCampaignEntries);
    setSelectedSavedRebuttalTitle(NEW_REBUTTAL_SENTINEL);
    setScriptTitle(nextTitle);
    setDeliveryTip('');
    setRebuttalsSaveMessage('Form cleared');

    if (rebuttalsEditorRef.current) {
      rebuttalsEditorRef.current.innerHTML = '';
    }
  };

  const handleSaveProcess = async () => {
    if (!processEditorRef.current) {
      return;
    }
    const processKey = selectedProcess;
    const draftHtml = processEditorRef.current.innerHTML.trim();
    const entries = getProcessEntries(workingProcess[processKey], processKey);
    const nextBucket: Record<string, string> = {};
    entries.forEach((entry) => {
      nextBucket[entry.title] = entry.content;
    });
    nextBucket[(processScriptTitle || processKey).trim() || processKey] = draftHtml;

    const updated: ProcessMap = {
      ...workingProcess,
      [processKey]: nextBucket,
    };
    try {
      const saved = await saveProcess(updated);
      setWorkingProcess(saved);
    } catch {
      window.alert('Error: Could not reach the server. Your changes were not saved.');
    }
  };

  const handleEditSavedProcess = (title: string) => {
    setView('process');
    setProcessScriptTitle(title);
  };

  const handleDeleteSavedProcess = async (title: string) => {
    try {
      await deleteProcessDraft(selectedProcess, title);
      const refreshed = await getProcess();
      setWorkingProcess(refreshed.working || DEFAULT_PROCESS_DATA);
      setLiveProcess(refreshed.live || DEFAULT_PROCESS_DATA);
      if (processScriptTitle === title) {
        setProcessScriptTitle(selectedProcess);
        if (processEditorRef.current) {
          processEditorRef.current.innerHTML = '';
        }
      }
    } catch {
      window.alert('Error: Could not reach the server. Your changes were not saved.');
    }
  };

  const isSupportedTransitionFile = (file: File) => {
    const name = file.name.toLowerCase();
    return name.endsWith('.doc') || name.endsWith('.docx') || name.endsWith('.pdf');
  };

  const readFileAsDataUrl = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Unable to read file'));
    reader.readAsDataURL(file);
  });

  const handleTransitionFile = async (file: File) => {
    if (!isSupportedTransitionFile(file)) {
      return;
    }
    const dataUrl = await readFileAsDataUrl(file);
    setPendingTransition({
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      dataUrl,
    });
    setTransitionsSaveMessage(`Ready to save: ${file.name}`);
  };

  const handleTransitionsInputChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files && event.target.files[0];
    if (!file) {
      return;
    }
    await handleTransitionFile(file);
  };

  const handleTransitionsDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files && event.dataTransfer.files[0];
    if (!file) {
      return;
    }
    await handleTransitionFile(file);
  };

  const handleSaveTransitions = async () => {
    if (!pendingTransition) {
      window.alert('Please select or drop a document before saving.');
      return;
    }
    try {
      setTransitionsSaveMessage('Saving...');
      await saveTransitions(pendingTransition);
      const refreshed = await getTransitions();
      setWorkingTransition(refreshed.working || null);
      setLiveTransition(refreshed.live || null);
      setPendingTransition(refreshed.working || null);
      setTransitionsSaveMessage(`Saved: ${(refreshed.working && refreshed.working.fileName) || pendingTransition.fileName}`);
    } catch {
      setTransitionsSaveMessage('Save failed');
      window.alert('Error: Could not reach the server. Your changes were not saved.');
    }
  };

  const handleEditSavedTransition = () => {
    setView('transitions');
    setPendingTransition(workingTransition || liveTransition || null);
  };

  const handleDeleteSavedTransition = async () => {
    try {
      setTransitionsSaveMessage('Deleting...');
      await deleteTransitionsDraft();
      const refreshed = await getTransitions();
      setWorkingTransition(refreshed.working || null);
      setLiveTransition(refreshed.live || null);
      setPendingTransition(refreshed.working || null);
      setTransitionsSaveMessage('Deleted: Transitions document');
    } catch {
      setTransitionsSaveMessage('Delete failed');
      window.alert('Error: Could not reach the server. Your changes were not saved.');
    }
  };

  const handleGoLive = async () => {
    let mergedLiveRebuttals: RebuttalsMap = {};
    let rebuttalsPublished = false;
    let mergedLiveProcess: ProcessMap = { ...DEFAULT_PROCESS_DATA };
    let nextLiveTransition: TransitionFileRef | null = null;

    const rebuttalsForPublish = { ...workingRebuttals };
    if (view === 'rebuttals' && selectedClient && selectedClient !== ALL_CAMPAIGNS && rebuttalsEditorRef.current) {
      const currentTitle = (scriptTitle || selectedClient).trim() || selectedClient;
      const currentContent = rebuttalsEditorRef.current.innerHTML.trim();
      const currentDeliveryTip = deliveryTip.trim();
      const currentBucket = buildRebuttalBucket(rebuttalsForPublish[selectedClient], selectedClient);
      const liveBucket = buildRebuttalBucket(liveRebuttals[selectedClient], selectedClient);
      const liveSnapshot = liveBucket[currentTitle] || { title: currentTitle, content: '', deliveryTip: '' };
      const hasWorkingDraft = hasScriptValue(workingRebuttals[selectedClient], selectedClient);
      const isUnchangedLiveMirror = !hasWorkingDraft
        && normalizeHtmlText(currentContent) === normalizeHtmlText(liveSnapshot.content || '')
        && currentTitle === (liveSnapshot.title || selectedClient)
        && currentDeliveryTip === (liveSnapshot.deliveryTip || '');

      if (!isUnchangedLiveMirror) {
        if (currentContent || currentDeliveryTip) {
          currentBucket[currentTitle] = {
            title: currentTitle,
            content: currentContent,
            deliveryTip: currentDeliveryTip,
          };
        } else {
          delete currentBucket[currentTitle];
        }

        if (Object.keys(currentBucket).length > 0) {
          rebuttalsForPublish[selectedClient] = currentBucket;
        } else {
          delete rebuttalsForPublish[selectedClient];
        }
      }
    }

    let processForPublish = { ...workingProcess };
    if (view === 'process' && processEditorRef.current) {
      const currentEntries = getProcessEntries(processForPublish[selectedProcess], selectedProcess);
      const nextBucket: Record<string, string> = {};
      currentEntries.forEach((entry) => {
        nextBucket[entry.title] = entry.content;
      });
      nextBucket[(processScriptTitle || selectedProcess).trim() || selectedProcess] = processEditorRef.current.innerHTML.trim();
      processForPublish = {
        ...processForPublish,
        [selectedProcess]: nextBucket,
      };
    }

    try {
      // Persist the latest editor content before live publish to keep Working and Live in sync.
      const savedWorking = await saveRebuttals(rebuttalsForPublish);
      const savedProcessWorking = await saveProcess(processForPublish);
      const savedTransitionWorking = pendingTransition
        ? await saveTransitions(pendingTransition)
        : workingTransition;
      const livePayload = await publishLive(savedWorking, savedProcessWorking, savedTransitionWorking);
      mergedLiveRebuttals = livePayload.rebuttalsLive;
      mergedLiveProcess = livePayload.processLive;
      nextLiveTransition = livePayload.transitionsLive;

      setWorkingRebuttals(savedWorking);
      setWorkingProcess(savedProcessWorking);
      setWorkingTransition(savedTransitionWorking || null);
      setPendingTransition(savedTransitionWorking || null);
      setLiveRebuttals(mergedLiveRebuttals);
      setLiveProcess(mergedLiveProcess);
      setLiveTransition(nextLiveTransition);
      rebuttalsPublished = true;

      if (view === 'rebuttals' && selectedClient && selectedClient !== ALL_CAMPAIGNS) {
        const liveCheck = await getLiveRebuttals();
        const expectedEntries = getRebuttalEntries(rebuttalsForPublish[selectedClient], selectedClient);
        const actualEntries = getRebuttalEntries(liveCheck.live[selectedClient], selectedClient);
        const expectedScript = expectedEntries.find((entry) => entry.title === ((scriptTitle || selectedClient).trim() || selectedClient)) || expectedEntries[0] || { title: '', content: '', deliveryTip: '', campaign: selectedClient };
        const actualScript = actualEntries.find((entry) => entry.title === expectedScript.title) || actualEntries[0] || { title: '', content: '', deliveryTip: '', campaign: selectedClient };
        const expectedText = normalizeHtmlText(expectedScript.content);
        const actualText = normalizeHtmlText(actualScript.content);
        const expectedTip = (expectedScript.deliveryTip || '').trim();
        const actualTip = (actualScript.deliveryTip || '').trim();
        if ((expectedText && actualText !== expectedText) || expectedTip !== actualTip) {
          throw new Error('Live verification failed');
        }
      }
    } catch {
      window.alert('Error: Could not reach the server. Your changes were not saved.');
    }

    if (rebuttalsPublished) {
      setRebuttalsSaveMessage('GO LIVE complete');
      window.alert('Global GO LIVE complete. Rebuttals, Verification, and Transitions were pushed to all live agents. Your current Manager section will stay open so you can continue editing or delete the saved item from the sidebar.');
      return;
    }
  };

  const savedRebuttalEntries = Object.keys(workingRebuttals).flatMap((campaign) => getRebuttalEntries(workingRebuttals[campaign], campaign));
  const selectedCampaignEntries = selectedClient && selectedClient !== ALL_CAMPAIGNS
    ? (() => {
        const workingEntries = getRebuttalEntries(workingRebuttals[selectedClient], selectedClient);
        return workingEntries.length ? workingEntries : getRebuttalEntries(liveRebuttals[selectedClient], selectedClient);
      })()
    : [];
  const savedProcessEntries = getProcessEntries(workingProcess[selectedProcess], selectedProcess);
  const savedTransitionEntries = workingTransition ? [workingTransition] : liveTransition ? [liveTransition] : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', background: '#f8f9fa', overflow: 'hidden', fontFamily: 'sans-serif' }}>
      
      {/* HEADER */}
      <header style={{ background: '#1e67cc', color: 'white', padding: '15px 0', textAlign: 'center', width: '100%', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
        <h1 style={{ margin: 0, fontSize: '1.6rem' }}>QV Manager Content Editor</h1>
      </header>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* SIDEBAR NAVIGATION */}
        <aside style={{ width: '260px', background: 'white', padding: '20px', borderRight: '1px solid #ddd', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ color: '#003366', marginTop: 0, borderBottom: '2px solid #1e67cc', paddingBottom: '10px' }}>
            {view === 'process' ? `QV Saved ${selectedProcess}` : view === 'transitions' ? 'QV Saved Transitions' : 'QV Saved Rebuttals'}
          </h3>

          <div style={{ marginTop: '8px', marginBottom: '12px', display: 'flex', flexDirection: 'column', overflowY: 'auto', maxHeight: view === 'rebuttals' ? '70vh' : '260px' }}>
            {view === 'transitions' ? (
              savedTransitionEntries.length === 0 ? (
                <div style={{ fontSize: '12px', color: '#6b7280' }}>No saved transition document yet.</div>
              ) : (
                savedTransitionEntries.map((transition) => (
                  <div key={transition.fileName} style={{ border: '1px solid #d7ddea', borderRadius: '6px', padding: '8px', marginBottom: '8px', background: '#f8f9fc' }}>
                    <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#1f2937', marginBottom: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {transition.fileName}
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={handleEditSavedTransition} style={{ flex: 1, padding: '6px', background: '#1e67cc', color: 'white', border: 'none', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}>✏️ Edit</button>
                      <button onClick={handleDeleteSavedTransition} style={{ flex: 1, padding: '6px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}>🗑️ Delete</button>
                    </div>
                  </div>
                ))
              )
            ) : view === 'process' ? (
              savedProcessEntries.length === 0 ? (
                <div style={{ fontSize: '12px', color: '#6b7280' }}>{`No saved ${selectedProcess} drafts yet.`}</div>
              ) : (
                savedProcessEntries.map((entry) => (
                  <div key={entry.title} style={{ border: '1px solid #d7ddea', borderRadius: '6px', padding: '8px', marginBottom: '8px', background: '#f8f9fc' }}>
                    <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#1f2937', marginBottom: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {entry.title}
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => handleEditSavedProcess(entry.title)} style={{ flex: 1, padding: '6px', background: '#1e67cc', color: 'white', border: 'none', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}>✏️ Edit</button>
                      <button onClick={() => handleDeleteSavedProcess(entry.title)} style={{ flex: 1, padding: '6px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}>🗑️ Delete</button>
                    </div>
                  </div>
                ))
              )
            ) : savedRebuttalEntries.length === 0 ? (
              <div style={{ fontSize: '12px', color: '#6b7280' }}>No saved rebuttal drafts yet.</div>
            ) : (
              savedRebuttalEntries.map((item) => (
                <div key={`${item.campaign}-${item.title}`} style={{ border: '1px solid #d7ddea', borderRadius: '6px', padding: '8px', marginBottom: '8px', background: '#f8f9fc' }}>
                  <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#1f2937', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.title}
                  </div>
                  <div style={{ fontSize: '10px', color: '#6b7280', marginBottom: '6px' }}>{item.campaign}</div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => handleEditSavedRebuttal(item.campaign, item.title)} style={{ flex: 1, padding: '6px', background: '#1e67cc', color: 'white', border: 'none', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}>✏️ Edit</button>
                    <button onClick={() => handleDeleteSavedRebuttal(item.campaign, item.title)} style={{ flex: 1, padding: '6px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}>🗑️ Delete</button>
                  </div>
                </div>
              ))
            )}
          </div>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '15px' }}>
            <button onClick={() => setView('menu')} style={{ padding: '12px', cursor: 'pointer', background: view === 'menu' ? '#1e67cc' : '#f8f9fa', color: view === 'menu' ? 'white' : '#333', border: '1px solid #ddd', borderRadius: '6px', fontWeight: 'bold', textAlign: 'left' }}>🏠 Main Menu</button>
            <button onClick={() => setView('rebuttals')} style={{ padding: '12px', cursor: 'pointer', background: view === 'rebuttals' ? '#1e67cc' : '#f8f9fa', color: view === 'rebuttals' ? 'white' : '#333', border: '1px solid #ddd', borderRadius: '6px', fontWeight: 'bold', textAlign: 'left' }}>📝 Update Rebuttals</button>
            <button onClick={() => setView('transitions')} style={{ padding: '12px', cursor: 'pointer', background: view === 'transitions' ? '#1e67cc' : '#f8f9fa', color: view === 'transitions' ? 'white' : '#333', border: '1px solid #ddd', borderRadius: '6px', fontWeight: 'bold', textAlign: 'left' }}>🔄 Update Transitions</button>
            <button onClick={() => setView('process')} style={{ padding: '12px', cursor: 'pointer', background: view === 'process' ? '#1e67cc' : '#f8f9fa', color: view === 'process' ? 'white' : '#333', border: '1px solid #ddd', borderRadius: '6px', fontWeight: 'bold', textAlign: 'left' }}>⚙️ Update Verification</button>
          </nav>

          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button onClick={handleGoLive} style={{ padding: '12px', background: '#28a745', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>🚀 GO LIVE</button>
            <Link to="/managers" style={{ padding: '12px', background: '#003366', color: 'white', textAlign: 'center', textDecoration: 'none', borderRadius: '6px', fontWeight: 'bold' }}>🏠 Home</Link>
          </div>
        </aside>

        {/* MAIN EDITING AREA */}
        <main style={{ flex: 1, padding: '30px', overflowY: 'auto' }}>

          {view === 'menu' && (
            <div style={{ textAlign: 'center', marginTop: '100px', color: '#666' }}>
              <h2>Welcome, Manager</h2>
              <p>Select a section from the left sidebar to begin editing.</p>
            </div>
          )}

          {/* REBUTTALS EDITOR */}
          {view === 'rebuttals' && (
            <div style={{ background: 'white', padding: '25px', borderRadius: '10px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxWidth: '950px', margin: '0 auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                <h2 style={{ margin: 0, color: '#003366' }}>Rebuttals Editor</h2>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <select value={selectedClient} onChange={(e) => { setSelectedClient(e.target.value); setSelectedSavedRebuttalTitle(''); }} style={{ padding: '10px', borderRadius: '6px' }}>
                    {clients.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  {selectedClient !== ALL_CAMPAIGNS ? (
                    <>
                      <select
                        value={selectedSavedRebuttalTitle}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === NEW_REBUTTAL_SENTINEL) {
                            const nextTitle = getNextUntitledRebuttalTitle(selectedCampaignEntries);
                            setSelectedSavedRebuttalTitle(NEW_REBUTTAL_SENTINEL);
                            setScriptTitle(nextTitle);
                            setDeliveryTip('');
                            if (rebuttalsEditorRef.current) {
                              rebuttalsEditorRef.current.innerHTML = '';
                            }
                            return;
                          }
                          setSelectedSavedRebuttalTitle(value);
                          setScriptTitle(value);
                        }}
                        style={{ padding: '10px', borderRadius: '6px', maxWidth: '210px' }}
                      >
                        {selectedCampaignEntries.length === 0 ? <option value="">No saved rebuttals yet</option> : null}
                        {selectedCampaignEntries.map((entry) => (
                          <option key={entry.title} value={entry.title}>{entry.title}</option>
                        ))}
                        <option value={NEW_REBUTTAL_SENTINEL}>+ New Rebuttal</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          const nextTitle = getNextUntitledRebuttalTitle(selectedCampaignEntries);
                          setSelectedSavedRebuttalTitle(NEW_REBUTTAL_SENTINEL);
                          setScriptTitle(nextTitle);
                          setDeliveryTip('');
                          if (rebuttalsEditorRef.current) {
                            rebuttalsEditorRef.current.innerHTML = '';
                          }
                          setRebuttalsSaveMessage('New rebuttal ready');
                        }}
                        style={{ padding: '10px 12px', borderRadius: '6px', border: '1px solid #1e67cc', background: '#eef5ff', color: '#1e67cc', fontWeight: 'bold', cursor: 'pointer' }}
                      >
                        + New
                      </button>
                    </>
                  ) : null}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <label htmlFor="scriptTitleInput" style={{ fontSize: '12px', fontWeight: 'bold', color: '#374151' }}>Script Title</label>
                    <input id="scriptTitleInput" type="text" value={scriptTitle} disabled={selectedClient === ALL_CAMPAIGNS} onChange={(e) => setScriptTitle(e.target.value)} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ccc', minWidth: '180px', background: selectedClient === ALL_CAMPAIGNS ? '#f3f4f6' : '#fff' }} />
                  </div>
                </div>
              </div>
              {/* Status indicator */}
              {(() => {
                const isDraft = selectedClient !== ALL_CAMPAIGNS && hasScriptValue(workingRebuttals[selectedClient], selectedClient);
                return (
                  <div style={{ marginBottom: '12px', fontSize: '13px', fontWeight: 'bold', color: isDraft ? '#856404' : '#0c5460', background: isDraft ? '#fff3cd' : '#d1ecf1', border: `1px solid ${isDraft ? '#ffc107' : '#bee5eb'}`, borderRadius: '4px', padding: '6px 14px', display: 'inline-block' }}>
                    {selectedClient === ALL_CAMPAIGNS ? '📚 Status: All Campaign Library View' : (isDraft ? '✏️ Status: Draft Mode' : '📡 Status: Mirroring Live Content')}
                  </div>
                );
              })()}
              {/* Toolbar */}
              <div style={{ display: 'flex', gap: '8px', background: '#f1f3f5', padding: '10px', border: '1px solid #ccc', borderBottom: 'none', borderRadius: '6px 6px 0 0', flexWrap: 'wrap' }}>
                <button onMouseDown={(event) => applyToolbarCommand(event, 'bold')} style={{ padding: '5px 12px', fontWeight: 'bold' }}>B</button>
                <button onMouseDown={(event) => applyToolbarCommand(event, 'italic')} style={{ padding: '5px 12px', fontStyle: 'italic' }}>I</button>
                <button onMouseDown={(event) => applyToolbarCommand(event, 'underline')} style={{ padding: '5px 12px', textDecoration: 'underline' }}>U</button>
                <select defaultValue="" onMouseDown={saveCurrentSelection} onChange={(e) => { handleHighlight(e.target.value); e.target.value = ''; }} style={{ padding: '5px 8px' }}>
                  <option value="">Highlight ▾</option>
                  <option value="#fff59d">Soft Yellow</option>
                  <option value="#ffecb3">Warm Amber</option>
                  <option value="#c8e6c9">Soft Green</option>
                  <option value="#bbdefb">Soft Blue</option>
                  <option value="#f8bbd0">Soft Pink</option>
                  <option value="#e1bee7">Soft Lavender</option>
                </select>
                <select onChange={(e) => handleFormat('fontSize', e.target.value)} style={{ padding: '5px 8px' }}>
                  <option value="3">Size</option>
                  <option value="1">Small</option>
                  <option value="3">Normal</option>
                  <option value="5">Large</option>
                  <option value="7">Huge</option>
                </select>
                <button onMouseDown={handleToolbarMouseDown} onClick={insertPresentationBreak} disabled={selectedClient === ALL_CAMPAIGNS} style={{ padding: '5px 12px', fontWeight: 'bold', background: selectedClient === ALL_CAMPAIGNS ? '#93a4bc' : '#e8f1ff', color: selectedClient === ALL_CAMPAIGNS ? '#fff' : '#1e67cc', border: '1px solid #bcd0f0', borderRadius: '4px', cursor: selectedClient === ALL_CAMPAIGNS ? 'not-allowed' : 'pointer' }}>3rd Pres Break</button>
              </div>
              <div ref={rebuttalsEditorRef} contentEditable={selectedClient !== ALL_CAMPAIGNS} onMouseUp={saveCurrentSelection} onKeyUp={saveCurrentSelection} onInput={saveCurrentSelection} style={{ minHeight: '400px', border: '1px solid #ccc', padding: '20px', outline: 'none', background: '#fff', fontSize: '1.1rem' }} />
              {selectedClient !== ALL_CAMPAIGNS ? (
                <div style={{ marginTop: '16px', padding: '14px', borderRadius: '10px', border: '1px solid #b9d8ff', background: 'linear-gradient(180deg, #f4f9ff 0%, #eef6ff 100%)' }}>
                  <label htmlFor="deliveryTipInput" style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#1e4f8f', marginBottom: '6px' }}>
                    💡 Delivery/Tone Tips
                  </label>
                  <div style={{ fontSize: '12px', color: '#4b6484', marginBottom: '8px', lineHeight: 1.4 }}>
                    Keep coaching notes here so they stay separate from the live rebuttal script.
                  </div>
                  <textarea
                    id="deliveryTipInput"
                    value={deliveryTip}
                    onChange={(event) => setDeliveryTip(event.target.value)}
                    placeholder="Stay confident, not defensive"
                    rows={3}
                    style={{ width: '100%', borderRadius: '8px', border: '1px solid #9fc5f8', padding: '10px 12px', resize: 'vertical', fontFamily: 'inherit', fontSize: '14px', color: '#1f2937', background: '#fffefb', boxSizing: 'border-box' }}
                  />
                  <div style={{ marginTop: '12px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#1e4f8f', marginBottom: '6px' }}>Agent Hover Preview</div>
                    <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '4px', maxWidth: '280px', background: '#1f2937', color: '#fff', padding: '10px 12px', borderRadius: '8px', boxShadow: '0 8px 18px rgba(0,0,0,0.18)' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700 }}>Delivery Tip</div>
                      <div style={{ fontSize: '12px', lineHeight: 1.45, color: '#f8fafc' }}>{deliveryTip.trim() || 'Preview your coaching tip here before publishing it to agents.'}</div>
                    </div>
                    <div style={{ marginTop: '6px', fontSize: '11px', color: '#5b6f8a' }}>{deliveryTip.trim().length} characters</div>
                  </div>
                </div>
              ) : null}
              {rebuttalsSaveMessage ? <div style={{ marginTop: '10px', fontSize: '12px', fontWeight: 'bold', color: rebuttalsSaveMessage === 'Save failed' ? '#b91c1c' : '#0f5132' }}>{rebuttalsSaveMessage}</div> : null}
              <div style={{ marginTop: '20px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <button onClick={handleSaveRebuttals} disabled={selectedClient === ALL_CAMPAIGNS} style={{ padding: '15px 40px', background: selectedClient === ALL_CAMPAIGNS ? '#93a4bc' : '#1e67cc', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: selectedClient === ALL_CAMPAIGNS ? 'not-allowed' : 'pointer' }}>SAVE TO LIBRARY</button>
                <button onClick={handleClearRebuttalForm} disabled={selectedClient === ALL_CAMPAIGNS} style={{ padding: '15px 28px', background: selectedClient === ALL_CAMPAIGNS ? '#cbd5e1' : '#e5e7eb', color: '#1f2937', border: '1px solid #cbd5e1', borderRadius: '6px', fontWeight: 'bold', cursor: selectedClient === ALL_CAMPAIGNS ? 'not-allowed' : 'pointer' }}>CLEAR FORM</button>
              </div>
            </div>
          )}

          {/* TRANSITIONS UPLOADER */}
          {view === 'transitions' && (
            <div style={{ background: 'white', padding: '40px', borderRadius: '10px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
              <h2 style={{ color: '#003366', marginBottom: '20px' }}>Update Transitions</h2>
              <div onDragOver={(e) => e.preventDefault()} onDrop={handleTransitionsDrop} style={{ border: '2px dashed #ccc', padding: '50px', borderRadius: '10px', background: '#fafafa', marginBottom: '25px' }}>
                <input type="file" accept=".doc,.docx,.pdf" onChange={handleTransitionsInputChange} />
                <p style={{ marginTop: '10px', color: '#888' }}>{transitionsLoading ? 'Loading...' : 'Drop Word Doc or Google Doc here'}</p>
                {pendingTransition ? <p style={{ marginTop: '10px', color: '#1f2937', fontWeight: 'bold' }}>Selected: {pendingTransition.fileName}</p> : null}
              </div>
              {transitionsSaveMessage ? <div style={{ marginBottom: '12px', fontSize: '12px', fontWeight: 'bold', color: transitionsSaveMessage.includes('failed') ? '#b91c1c' : '#0f5132' }}>{transitionsSaveMessage}</div> : null}
              <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
                <button onClick={handleSaveTransitions} style={{ padding: '12px 30px', background: '#1e67cc', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold' }}>SAVE</button>
                <button onClick={handleGoLive} style={{ padding: '12px 30px', background: '#28a745', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold' }}>GO LIVE</button>
              </div>
            </div>
          )}

          {/* VERIFICATION EDITOR */}
          {view === 'process' && (
            <div style={{ background: 'white', padding: '25px', borderRadius: '10px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxWidth: '950px', margin: '0 auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                <h2 style={{ margin: 0, color: '#003366' }}>Update Verification</h2>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <select value={selectedProcess} onChange={(e) => setSelectedProcess(e.target.value as 'Verification')} style={{ padding: '10px', borderRadius: '6px', fontWeight: 'bold' }}>
                    <option value="Verification">Verification</option>
                  </select>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <label htmlFor="processScriptTitleInput" style={{ fontSize: '12px', fontWeight: 'bold', color: '#374151' }}>Script Title</label>
                    <input id="processScriptTitleInput" type="text" value={processScriptTitle} onChange={(e) => setProcessScriptTitle(e.target.value)} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ccc', minWidth: '180px' }} />
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', background: '#f1f3f5', padding: '10px', border: '1px solid #ccc', borderBottom: 'none', borderRadius: '6px 6px 0 0', flexWrap: 'wrap' }}>
                <button onMouseDown={(event) => applyToolbarCommand(event, 'bold')} style={{ padding: '5px 12px', fontWeight: 'bold' }}>B</button>
                <button onMouseDown={(event) => applyToolbarCommand(event, 'italic')} style={{ padding: '5px 12px', fontStyle: 'italic' }}>I</button>
                <button onMouseDown={(event) => applyToolbarCommand(event, 'underline')} style={{ padding: '5px 12px', textDecoration: 'underline' }}>U</button>
                <input type="color" title="Font Color" onMouseDown={saveCurrentSelection} onChange={(e) => handleFormat('foreColor', e.target.value)} />
                <select defaultValue="" onMouseDown={saveCurrentSelection} onChange={(e) => { handleHighlight(e.target.value); e.target.value = ''; }} style={{ padding: '5px 8px' }}>
                  <option value="">Highlight ▾</option>
                  <option value="#fff59d">Soft Yellow</option>
                  <option value="#ffecb3">Warm Amber</option>
                  <option value="#c8e6c9">Soft Green</option>
                  <option value="#bbdefb">Soft Blue</option>
                  <option value="#f8bbd0">Soft Pink</option>
                  <option value="#e1bee7">Soft Lavender</option>
                </select>
                <select onChange={(e) => handleFormat('fontSize', e.target.value)} style={{ padding: '5px 8px' }}>
                  <option value="3">Size</option>
                  <option value="3">Normal</option>
                  <option value="5">Large</option>
                </select>
              </div>
              <div ref={processEditorRef} contentEditable onMouseUp={saveCurrentSelection} onKeyUp={saveCurrentSelection} onInput={saveCurrentSelection} style={{ minHeight: '400px', border: '1px solid #ccc', padding: '20px', outline: 'none', background: '#fff', fontSize: '1.1rem' }} />
              <div style={{ marginTop: '20px', display: 'flex', gap: '15px' }}>
                <button onClick={handleSaveProcess} style={{ padding: '15px 40px', background: '#1e67cc', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold' }}>SAVE TO LIBRARY</button>
                <button onClick={handleGoLive} style={{ padding: '15px 40px', background: '#28a745', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold' }}>GO LIVE</button>
              </div>
            </div>
          )}
        </main>
      </div>

      <footer style={{ borderTop: '1px solid #d6dbe3', background: '#fff', padding: '14px 16px', textAlign: 'center', fontSize: '12px', color: '#4b5563', lineHeight: 1.4 }}>
        <div>{legalLine1}</div>
        <div>{legalLine2}</div>
      </footer>
    </div>
  );
};

export default ManagerDashboard;