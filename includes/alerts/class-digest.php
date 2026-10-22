<?php

namespace Redirection\Alerts;

use Redirection\Log\Error;
use Redirection\Redirect\Redirect;
use Redirection\Settings\Settings;

/**
 * Daily or weekly email of new 404s, so the team hears about broken URLs without logging in.
 *
 * @phpstan-type AlertSettings array{enabled: bool, frequency: 'daily'|'weekly', recipients: list<string>, min_hits: int}
 * @phpstan-type DigestRow array{url: string, hits: int, referrer: string}
 */
class Digest {
	const HOOK = 'dsr_404_digest';
	const SETTINGS_KEY = 'dsr_alerts';
	// Its own option, so saving settings can never reset it.
	const LAST_SENT_OPTION = 'dsr_404_digest_last_sent';
	const FREQUENCIES = [ 'daily', 'weekly' ];
	const MAX_ROWS = 20;
	const MAX_RECIPIENTS = 10;
	const DEFAULT_MIN_HITS = 3;
	// Some top URLs may already be redirected, so fetch more than are sent.
	// ponytail: fixed candidate window; page through if sites have hundreds of redirected top 404s.
	const MAX_CANDIDATES = 200;

	/**
	 * @return AlertSettings
	 */
	public static function defaults() {
		return [
			'enabled' => false,
			'frequency' => 'weekly',
			'recipients' => [ (string) get_option( 'admin_email' ) ],
			'min_hits' => self::DEFAULT_MIN_HITS,
		];
	}

	/**
	 * @param mixed $value Settings from the API.
	 * @return AlertSettings
	 */
	public static function sanitize( $value ) {
		$value = is_array( $value ) ? $value : [];
		$defaults = self::defaults();
		$recipients = $value['recipients'] ?? $defaults['recipients'];
		$recipients = is_array( $recipients ) ? $recipients : explode( ',', (string) $recipients );
		$recipients = array_values(
			array_unique(
				array_filter(
					array_map(
						static function ( $email ) {
							return sanitize_email( trim( (string) $email ) );
						},
						$recipients
					),
					static function ( $email ) {
						return is_email( $email ) !== false;
					}
				)
			)
		);

		return [
			'enabled' => ! empty( $value['enabled'] ),
			'frequency' => in_array( $value['frequency'] ?? '', self::FREQUENCIES, true ) ? $value['frequency'] : $defaults['frequency'],
			'recipients' => count( $recipients ) > 0 ? array_slice( $recipients, 0, self::MAX_RECIPIENTS ) : $defaults['recipients'],
			'min_hits' => max( 1, intval( $value['min_hits'] ?? $defaults['min_hits'], 10 ) ),
		];
	}

	/**
	 * The URLs worth an email: enough hits, not already redirected, most hit first, at most MAX_ROWS.
	 *
	 * @param list<DigestRow>          $rows 404s grouped by URL.
	 * @param int                      $min_hits Fewest hits worth mentioning.
	 * @param callable(string): bool   $is_redirected Whether a live redirect now handles a URL.
	 * @return list<DigestRow>
	 */
	public static function select( array $rows, $min_hits, callable $is_redirected ) {
		usort(
			$rows,
			static function ( $first, $second ) {
				return $second['hits'] <=> $first['hits'];
			}
		);

		$selected = [];

		foreach ( $rows as $row ) {
			if ( count( $selected ) >= self::MAX_ROWS ) {
				break;
			}

			if ( $row['hits'] >= $min_hits && ! $is_redirected( $row['url'] ) ) {
				$selected[] = $row;
			}
		}

		return $selected;
	}

	/**
	 * The cron job. With nothing new no email is sent, but the window still moves on; a failed send keeps the
	 * window so the next run retries.
	 *
	 * @return bool Whether an email was sent.
	 */
	public static function run() {
		$alerts = Settings::get()[ self::SETTINGS_KEY ];

		if ( ! $alerts['enabled'] ) {
			return false;
		}

		$now = time();
		$last_sent = intval( get_option( self::LAST_SENT_OPTION, 0 ), 10 );
		// Never more than one period back, so "today" and "this week" stay true after a pause or on the first run.
		$period = $alerts['frequency'] === 'daily' ? DAY_IN_SECONDS : WEEK_IN_SECONDS;
		$since = max( $last_sent, $now - $period );
		$rows = self::select( self::get_rows( $since ), $alerts['min_hits'], [ Redirect::class, 'matches_any' ] );

		if ( count( $rows ) === 0 ) {
			update_option( self::LAST_SENT_OPTION, $now, false );
			return false;
		}

		$sent = wp_mail(
			$alerts['recipients'],
			self::get_subject( count( $rows ), $alerts['frequency'] ),
			self::get_body( $rows ),
			[ 'Content-Type: text/html; charset=UTF-8' ]
		);

		if ( ! $sent ) {
			// @phpstan-ignore disallowed.function
			error_log( 'DSuite Redirects: the 404 digest email could not be sent' ); // phpcs:ignore
			return false;
		}

		update_option( self::LAST_SENT_OPTION, $now, false );
		return true;
	}

	/**
	 * Match the cron event to the settings. Only a change of frequency or on/off touches it, so the next send
	 * doesn't move every time settings are saved.
	 *
	 * @param AlertSettings $alerts Alert settings.
	 * @return void
	 */
	public static function schedule( array $alerts ) {
		if ( ! $alerts['enabled'] ) {
			self::clear();
			return;
		}

		if ( wp_get_schedule( self::HOOK ) === $alerts['frequency'] ) {
			return;
		}

		self::clear();
		wp_schedule_event( time() + DAY_IN_SECONDS, $alerts['frequency'], self::HOOK );
	}

	/**
	 * @return void
	 */
	public static function clear() {
		wp_clear_scheduled_hook( self::HOOK );
	}

	/**
	 * @param int $since UTC timestamp.
	 * @return list<DigestRow>
	 */
	private static function get_rows( $since ) {
		global $wpdb;

		// 404 rows store site-local time (current_time( 'mysql' )).
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT url, COUNT(*) AS hits FROM {$wpdb->prefix}redirection_404 WHERE created > %s GROUP BY url ORDER BY hits DESC LIMIT %d",
				wp_date( 'Y-m-d H:i:s', $since ),
				self::MAX_CANDIDATES
			)
		);
		$rows = is_array( $rows ) ? $rows : [];
		$referrers = Error::get_top_referrers( array_column( $rows, 'url' ) );

		return array_values(
			array_map(
				static function ( $row ) use ( $referrers ) {
					return [
						'url' => (string) $row->url,
						'hits' => intval( $row->hits, 10 ),
						'referrer' => $referrers[ $row->url ] ?? '',
					];
				},
				$rows
			)
		);
	}

	/**
	 * @param int    $count URLs in the email.
	 * @param string $frequency daily or weekly.
	 * @return string
	 */
	private static function get_subject( $count, $frequency ) {
		$site = wp_specialchars_decode( (string) get_bloginfo( 'name' ), ENT_QUOTES );

		if ( $frequency === 'daily' ) {
			/* translators: 1: site name, 2: number of URLs */
			$format = _n( '[%1$s] %2$d new 404 today', '[%1$s] %2$d new 404s today', $count, 'dsuite-redirects' );
		} else {
			/* translators: 1: site name, 2: number of URLs */
			$format = _n( '[%1$s] %2$d new 404 this week', '[%1$s] %2$d new 404s this week', $count, 'dsuite-redirects' );
		}

		return sprintf( $format, $site, $count );
	}

	/**
	 * @param list<DigestRow> $rows URLs to list.
	 * @return string HTML.
	 */
	private static function get_body( array $rows ) {
		$page = admin_url( 'admin.php?page=' . basename( REDIRECTION_FILE ) );
		$cells = 'style="padding:6px 12px;border-bottom:1px solid #e5e7eb;text-align:left"';
		$html = '<table style="border-collapse:collapse;font-family:sans-serif;font-size:14px">';
		$html .= sprintf(
			'<tr><th %1$s>%2$s</th><th %1$s>%3$s</th><th %1$s>%4$s</th><th %1$s></th></tr>',
			$cells,
			esc_html__( 'URL', 'dsuite-redirects' ),
			esc_html__( 'Hits', 'dsuite-redirects' ),
			esc_html__( 'Top referrer', 'dsuite-redirects' )
		);

		foreach ( $rows as $row ) {
			$html .= sprintf(
				'<tr><td %1$s>%2$s</td><td %1$s>%3$d</td><td %1$s>%4$s</td><td %1$s><a href="%5$s">%6$s</a></td></tr>',
				$cells,
				esc_html( $row['url'] ),
				$row['hits'],
				esc_html( $row['referrer'] ),
				esc_url( $page . '#/redirects?new=1&from=' . rawurlencode( $row['url'] ) ),
				esc_html__( 'Create redirect', 'dsuite-redirects' )
			);
		}

		$html .= '</table>';
		$html .= sprintf(
			'<p style="font-family:sans-serif;font-size:13px"><a href="%1$s">%2$s</a></p>',
			esc_url( $page . '#/settings' ),
			esc_html__( 'Manage alerts', 'dsuite-redirects' )
		);

		return $html;
	}
}
